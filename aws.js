const _ = require('lodash');
const AWS = require('aws-sdk');

AWS.config.update({
  region: 'eu-west-1'
});

const defaultParams = {
  apiVersion: '2016-11-15'
};
const masterCredentials = new AWS.EnvironmentCredentials('AWS');

const ec2Clients = {
  default: new AWS.EC2(defaultParams)
};

function createEC2Client(roleArn) {
  const tempCredentials = new AWS.TemporaryCredentials({
      RoleArn: roleArn,
      RoleSessionName: 'LambdaWhitelist'
    },
    masterCredentials
  );

  const params = _.merge(defaultParams, {
    credentials: tempCredentials
  });
  ec2Clients[roleArn] = new AWS.EC2(params);

  return ec2Clients[roleArn];
}

function getEC2Client(roleArn) {
  return new Promise((resolve, reject) => {
    if (!roleArn) return resolve(ec2Clients.default);

    if (!ec2Clients[roleArn]) return resolve(createEC2Client(roleArn));

    return resolve(ec2Clients[roleArn]);
  });
}

function generateTagParams(tags) {
  return tags.map(tag => ({
    Name: `tag:${tag.key}`,
    Values: [tag.value]
  }));
}

function generateIpRangesParam(id, ips, ports) {
  return {
    DryRun: false,
    GroupId: id,
    IpPermissions: [{
      FromPort: ports.from,
      ToPort: ports.to,
      IpProtocol: 'tcp',
      IpRanges: ips.map(ip => ({
        CidrIp: `${ip}`
      }))
    }]
  };
}

module.exports.getSecurityGroupsWithTags = function(tags, roleArn, ports) {
  const params = {
    DryRun: false,
    Filters: generateTagParams(tags)
  };

  return getEC2Client(roleArn).then(client => {
    return client.describeSecurityGroups(params).promise()
      .then(response => {
        const securityGroups = response.SecurityGroups;

        console.log(`Found ${securityGroups.length} security groups.`);


        const newSecurityGroups = securityGroups
          .map(sg => _.merge({}, sg, {
            roleArn,
            ports
          }));

        return Promise.resolve(newSecurityGroups);
      })
      .catch(error => error.message);
  });
}

module.exports.addToSecurityGroup = function(id, ips, roleArn, ports) {
  if (!ips.length) {
    return Promise.resolve(`No IPs to add to ${id}.`);
  }

  const params = generateIpRangesParam(id, ips, ports);

  return getEC2Client(roleArn).then(client => {
    return client.authorizeSecurityGroupIngress(params).promise()
      .then(data => `Added ${ips.length} IPs to security group ${id}.`)
      .catch(error => `ERROR: ${id}: ${error.message}`);
  });

}

module.exports.removeFromSecurityGroup = function(id, ips, roleArn, ports) {
  if (!ips.length) {
    return Promise.resolve(`No IPs to remove from ${id}.`);
  }

  const params = generateIpRangesParam(id, ips, ports);

  return getEC2Client(roleArn).then(client => {
    return client.revokeSecurityGroupIngress(params).promise()
      .then(data => `Removed ${ips.length} IPs from security group ${id}.`)
      .catch(error => `ERROR: ${id}: ${error.message}`);
  });
}