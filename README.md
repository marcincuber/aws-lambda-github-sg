## AWS Lambda Function (Node v8.10) updating secruity groups with Github IPs

### Purpose of the function

For private deployment CI/CD tools such as TeamCity it is important to whitelist Github ips in the security groups for many purposes. They could be hooks, notifications or status updates. This lambda function makes it easy to maintain the up to date list of Github IPs and add them to AWS security groups.

### How it works

Lambda function(written in Node) is fetching latest list of IPs from github endpoint: `https://api.github.com/meta`. List of IPs is returned in JSON format.

Security groups are update based on tags attached to them. The following block which exists in `index.js` defines the tags and ports for ips.

```node
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
```

So with that any security group with tag named `SecurityGroupName` and value `github` will contain latest github IPs on port 80 and 443.

Feel free to update those.

In case you want to run the AWS lambda function automatically, you can setup a trigger in your AWS console. It is very easy. Also in lambda node environment if you attach a role to the lambda, the function will use that role to perform actions.

### Contact <a name="contact"></a>

If you have any questions, drop me an email marcincuber@hotmail.com or open an issue and leave stars! :)

Credit to [Himesh](https://github.com/himeshladva) for help.

