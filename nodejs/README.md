## AWS Lambda Function (Node v8.10) updating secruity groups with Github IPs

### How it works

Lambda function is fetching latest list of IPs from github endpoint: `https://api.github.com/meta`. List of IPs is returned in JSON format.

Security groups are update based on tags attached to them. The following block which exists in `index.js` defines the tags and ports for ips.

```node
const securitygroups = [{
  ports: {
    from: 80,
    to: 80
  },
  tags: [{
    key: "SourceList",
    value: "github"
  }]
}, {
  ports: {
    from: 443,
    to: 443
  },
  tags: [{
    key: "SourceList",
    value: "github"
  }]
}]
```

So with that any security group with tag named `SourceList` and value `github` will contain latest github IPs on port 80 and 443.

### Deploying lambda

Terraform script `main.tf` is available to deploy your lambda function. It creates necessary roles, cloudwatch event trigger and lambda function itself which uses `github-lambda.zip` file.

Cloudwatch event trigger is set up to trigger the lambda. Currently it is setup to be triggered from monday to thursday at 10am. Following block can be modified if you need a different cron:

```tf
resource "aws_cloudwatch_event_rule" "event_rule" {
    name = "github-lambda-event-rule-${var.environment}"
    description = "Event rule to trigger lambda at 10am (MON-THU)"
    schedule_expression = "cron(0 10 ? * MON-THU *)"
}
```

In case you change the code and the name of the handler, make sure to edit the following:

```tf
handler = "index.run"
```

* Set AWS credentials
* Zip lambda script `zip github-lambda.zip aws.js index.js`
* Initialise terraform `terraform init`
* Deploy terraform `terraform apply -auto-approve`

Note that terraform doesn't have remote backend config. It is important to setup one so please see [terraform backend docs](https://www.terraform.io/docs/backends/types/s3.html)

### Testing lambda locally

Export AWS credentials: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` then run:

```bash
docker run --rm -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -v "$PWD":/var/task lambci/lambda:nodejs8.10 index.run
```

Credit to [Himesh](https://github.com/himeshladva) for help.
