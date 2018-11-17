## AWS Lambda Function (Python 3.6) updating secruity groups with Github IPs

### How it works

Lambda function is fetching latest list of IPs from github endpoint: `https://api.github.com/meta`. List of IPs is returned in JSON format.

Security groups are update based on tags attached to them. The following block which exists in `github.py` handler `lambda_handler` defines the ports for ips.

```python
sg_ports = {
    "FromPort": [80, 443],
    "ToPort": [80, 443]
}
```

Tags and github api endpoint are picked up from Lambda's environment variables:

```python
sg_tag_name = os.environ["sg_tag_name"]
sg_tag_value = os.environ["sg_tag_value"]
api_github_endpoint = os.environ["api_github_endpoint"]

sg_filters = {
    "Name": f"tag:{sg_tag_name}",
    "Values": [f"{sg_tag_value}"]
}
```

Values for enviorment variables are defined in `main.tf`. It is a `terraform` deployment script which is used to deploy your lambda function with required permissions. Variables can be modified in the following block:

```tf
environment {
  variables = {
    sg_tag_name = "SourceList",
    sg_tag_value = "github",
    api_github_endpoint = "https://api.github.com/meta"
  }
}
```

Cloudwatch event trigger is also set up to trigger the lambda. Currently it is setup to be triggered from monday to thursday at 10am. Following block can be modified if you need a different cron:

```tf
resource "aws_cloudwatch_event_rule" "event_rule" {
    name = "github-lambda-event-rule-${var.environment}"
    description = "Event rule to trigger lambda at 10am (MON-THU)"
    schedule_expression = "cron(0 10 ? * MON-THU *)"
}
```

So with that any security group with tag named `SourceList` and value `github` will contain latest github IPs on port 80 and 443.

### Deploying lambda

* Set AWS credentials
* Zip lambda script `zip github-lambda.zip github.py`
* Initialise terraform `terraform init`
* Deploy terraform `terraform apply -auto-approve`

Note that terraform doesn't have remote backend config. It is important to setup one so please see [terraform backend docs](https://www.terraform.io/docs/backends/types/s3.html)

### Testing lambda locally

Export AWS credentials: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` then run:

```bash
docker run --rm -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -v "$PWD":/var/task lambci/lambda:python3.6 github.lambda_handler
```