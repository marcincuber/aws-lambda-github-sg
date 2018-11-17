## AWS Lambda Functions- auto update security groups

### Purpose of the function

For private deployment CI/CD tools such as TeamCity it is important to whitelist Github ips in the security groups for many purposes. They could be hooks, notifications or status updates. This lambda function makes it easy to maintain the up to date list of Github IPs and add them to AWS security groups.

Lambda functions have been written in NodeJS (v8.10) and Python (v3.6). Their primary use is to update tagged security groups with up-to-date Github IPs.

Functions can be found in the following:

* [Python3.6](python/) [README doc](python/README.md)
* [Node8.10](nodejs/) [README doc](nodejs/README.md)

### Contact <a name="contact"></a>

If you have any questions, drop me an email marcincuber@hotmail.com or open an issue and leave stars! :)
