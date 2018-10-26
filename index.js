const _ = require("lodash");
const awsHelper = require("./aws");
const https = require("https");

const options = {
  host: 'api.github.com',
  path: '/meta',
  headers: {
    'User-Agent': 'request'
  }
};

const securitygroups = [{
  ports: {
    from: 80,
    to: 80
  },
  tags: [{
    key: "SecurityGroupName",
    value: "github"
  }]
}, {
  ports: {
    from: 443,
    to: 443
  },
  tags: [{
    key: "SecurityGroupName",
    value: "github"
  }]
}]

const getIPs = (options) =>
  new Promise((resolve, reject) => {
    https.get(options, function(response) {
      let data = '';
      response.on('data', function(chunk) {
        data += chunk;
      });
      response.on('end', function() {
        if (response.statusCode === 200) {
          const json = JSON.parse(data);
          const ips = [...json.git, ...json.hooks, ...json.pages];
          resolve(_.uniq(ips));
        } else {
          console.log("failed ips");
          reject(new Error(`Status code: ${response.statusCode}`));
        }
      });
    }).on('error', function(error) {
      reject(error);
    });
  });

function getSecurityGroupIps(securityGroup) {
  return _(securityGroup.IpPermissions)
    .filter(permission => {
      return permission.FromPort === securityGroup.ports.from && permission.ToPort === securityGroup.ports.to;
    })
    .map('IpRanges')
    .flatten()
    .map(range => {
      return range.CidrIp;
    })
    .flatten()
    .compact()
    .value();
}

function getSecurityGroupUpdateData(securityGroups, instanceIPs) {
  return securityGroups.map(securityGroup => {
    const existing = getSecurityGroupIps(securityGroup);

    return {
      roleArn: securityGroup.roleArn,
      id: securityGroup.GroupId,
      ports: securityGroup.ports,
      whitelist: _.difference(instanceIPs, existing),
      blacklist: _.difference(existing, instanceIPs)
    };
  });
}

function generateSecurityGroupUpdatePromises(securityGroupUpdateData) {
  const whitelistPromises = securityGroupUpdateData.map(({
      id,
      whitelist,
      roleArn,
      ports
    }) =>
    awsHelper.addToSecurityGroup(id, whitelist, roleArn, ports));

  const blacklistPromises = securityGroupUpdateData.map(({
      id,
      blacklist,
      roleArn,
      ports
    }) =>
    awsHelper.removeFromSecurityGroup(id, blacklist, roleArn, ports));

  return [...whitelistPromises, ...blacklistPromises];
}

const run = module.exports.run = function() {
  const generateGetSecurityGroupsPromise = () => {
    return Promise.all(securitygroups.map(securitygroup =>
      awsHelper.getSecurityGroupsWithTags(securitygroup.tags, null, securitygroup.ports)));
  };

  return Promise.all([getIPs(options), generateGetSecurityGroupsPromise()])
    .then(values => {

      const IPs = values[0];
      const securityGroups = _.flatten(values[1]);
      const securityGroupUpdateData = getSecurityGroupUpdateData(securityGroups, IPs);

      // There will be at most 2 promises per security group
      return Promise.all(generateSecurityGroupUpdatePromises(securityGroupUpdateData))
        .then(values => {
          values.forEach(value => console.log(value));
          return `Finished updating sg`;
        })
        .catch(error => console.error(error));
    })
    .then(successMessage => console.log(successMessage))
    .catch(error => console.error(error));
}

run()