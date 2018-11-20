provider "aws" {
  region = "${var.region}"
  shared_credentials_file = "~/.aws/credentials"
  profile                 = "cloud-eng"
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "lambda_role" {
  name = "github-lambda-iam-role-${var.environment}"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

########## Assume role
resource "aws_iam_role" "cloudeng_assume_role" {
  name = "cloudeng-github-lambda-assume-role-${var.environment}"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "AWS": ["${aws_iam_role.lambda_role.arn}"]
      },
      "Effect": "Allow"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "cloudeng_assume_role_policy" {
  name = "cloudeng-assume-role-policy-${var.environment}"
  role = "${aws_iam_role.cloudeng_assume_role.id}"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeAddresses",
        "ec2:AuthorizeSecurityGroupEgress",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupEgress",
        "ec2:RevokeSecurityGroupIngress"
      ],
      "Resource": "*"
    }
  ]
}
EOF
}

##############
data "aws_iam_policy" "CloudWatchLogsFullAccess" {
  arn = "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
}

resource "aws_iam_role_policy_attachment" "cw-full-role-policy-attach" {
  role = "${aws_iam_role.lambda_role.name}"
  policy_arn = "${data.aws_iam_policy.CloudWatchLogsFullAccess.arn}"
}

resource "aws_lambda_function" "lambda" {
  description      = "Lambda function updating security group containing github public ips."
  filename         = "github-lambda.zip"
  function_name    = "github-lambda-${var.environment}"
  role             = "${aws_iam_role.lambda_role.arn}"

  handler          = "github.lambda_handler"
  source_code_hash = "${base64sha256(file("github-lambda.zip"))}"

  runtime          = "python3.6"
  memory_size      = "128"
  timeout          = "10"

  environment {
    variables = {
      sg_tag_name = "SourceList",
      sg_tag_value = "github",
      api_github_endpoint = "https://api.github.com/meta"
    }
  }

  tags {
    Service_Name = "github-lambda-${var.environment}",
    Service_Owner = "marcincuber@hotmail.com"
  }
}

resource "aws_cloudwatch_event_rule" "event_rule" {
    name = "github-lambda-event-rule-${var.environment}"
    description = "Event rule to trigger lambda at 10am (MON-THU)"
    schedule_expression = "cron(0 10 ? * MON-THU *)"
}

resource "aws_cloudwatch_event_target" "event_target" {
    rule = "${aws_cloudwatch_event_rule.event_rule.name}"
    arn = "${aws_lambda_function.lambda.arn}"
}

resource "aws_lambda_permission" "allow_lambda_invoke" {
    statement_id = "AllowExecutionFromCloudWatch"
    action = "lambda:InvokeFunction"
    function_name = "${aws_lambda_function.lambda.function_name}"
    principal = "events.amazonaws.com"
    source_arn = "${aws_cloudwatch_event_rule.event_rule.arn}"
}
