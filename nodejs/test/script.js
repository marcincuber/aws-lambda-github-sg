'use strict';
const _ = require('lodash');
const awsHelper = require('./aws');
const https = require('https');

const options = {
  host: 'api.github.com',
  path: '/meta',
  headers: {
    'User-Agent': 'request'
  }
};

const tags = [{ key: "SecurityGroupName", value: "github" }]

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
          resolve(ips);
        } else {
          reject(new Error(`Status code: ${response.statusCode}`));
        }
      });
    }).on('error', function(error) {
      reject(error);
    });
  });


getIPs(options).then(console.log).catch(console.error);

awsHelper.getSecurityGroupsWithTags(tags).then(sg => {
  const sgid = sg[0].GroupId;
  console.log(sgid);
})

