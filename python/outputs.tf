output "github_lambda_arn" {
  value = "${aws_lambda_function.lambda.arn}"
}

output "cloud_eng_assume_role_github_lambda_arn" {
  value = "${aws_iam_role.lambda_role.id}"
}