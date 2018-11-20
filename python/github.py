from botocore.vendored import requests
import os
import boto3
import json

def lambda_handler(event, context):
    '''
    Main Lambda Handler
    '''
    # Environment variables
    aws_region = os.environ["AWS_REGION"]
    sg_tag_name = os.environ["sg_tag_name"]
    sg_tag_value = os.environ["sg_tag_value"]
    api_github_endpoint = os.environ["api_github_endpoint"]

    # Security group filters
    sg_filters = {
        "Name": f"tag:{sg_tag_name}",
        "Values": [f"{sg_tag_value}"]
    }
    # Security group ports to whitelist ips
    sg_ports = {
        "FromPort": [80, 443],
        "ToPort": [80, 443]
    }

    # Get github ips
    try: 
        github_response = requests.get(f"{api_github_endpoint}").json()
        list_of_ips = github_ips(github_response)
        if not list_of_ips:
            raise Exception(f"List of github ips is empty for endpoint: {api_github_endpoint}. Exiting...")
    except Exception as error:
        raise Exception(error)

    # Read AWS accounts configs
    try:
        json_accounts_config = json.loads(open("config.json").read())
    except Exception as error:
        raise Exception(error)

    # Update sg in each account
    for account in json_accounts_config["Accounts"]:
        
        assume_role_arn=account["assume_role_arn"]
        try:
            client = assume_role(assume_role_arn, "ec2")
            print(f"Succesfully assumed role: {assume_role_arn}.")
        except Exception as error:
            print(f"Couldn't assume role: {assume_role_arn}.")
            print(error)
            continue

        try:
            sg_ids_list = get_sg_ids_by_tag(sg_filters, client)
        except Exception as error:
            raise Exception(error)

        for sg_id in sg_ids_list:
            try:
                update_sg(list_of_ips, sg_id, sg_ports, client)
            except Exception as error:
                raise Exception(error)

        print("")

    return ("Finished updating security groups!")

def assume_role(role_arn, client_type):
    sts_client = boto3.client("sts")

    assumedRoleObject = sts_client.assume_role(
        DurationSeconds=3600,
        RoleArn=role_arn,
        RoleSessionName="AssumeRoleSessionName"
    )

    credentials = assumedRoleObject["Credentials"]

    client = boto3.client(
        client_type,
        aws_access_key_id = credentials["AccessKeyId"],
        aws_secret_access_key = credentials["SecretAccessKey"],
        aws_session_token = credentials["SessionToken"]
    )

    return client

def github_ips(json_data):
    ips = []

    for iplist in json_data:
        if isinstance(json_data[iplist], list):
            ips+=json_data[iplist]

    return set(ips)

def check_cidr_validity(netaddress):
    try:
        ip, mask = netaddress.split("/")
        return netaddress
    except ValueError:
        return (netaddress + "/32")

def get_sg_ids_by_tag(filters, client):
    response = client.describe_security_groups(
        Filters=[filters]
    )

    sg_ids = []

    # Getting security group ids for provided filters
    for sg in response["SecurityGroups"]:
        sg_ids.append(sg["GroupId"])

    return sg_ids

def update_sg(all_ips, sg_id, sg_ports, client):
    '''
    This function determines what IPs need to be added/removed from the
    passed in security group
    '''

    # getting all the rules for the passed in security group
    response = client.describe_security_groups(
        Filters=[{
            "Name": "group-id",
            "Values": [sg_id]
        }]
    )

    permissions = response["SecurityGroups"][0]["IpPermissions"]

    add_permissions = []
    remove_permissions = []
    sg_ips_data = []
    sg_ips_list = []

    for permission in permissions:
        if permission["IpRanges"]:
            sg_ips_data.append({
                "FromPort": permission["FromPort"], 
                "ToPort": permission["ToPort"],
                "IpRanges": permission["IpRanges"],
                "IpProtocol": permission["IpProtocol"]
            })
            for sg_ip in permission["IpRanges"]:
                sg_ips_list.append({
                    "FromPort": permission["FromPort"], 
                    "ToPort": permission["ToPort"],
                    "IpRanges": [{"CidrIp":sg_ip["CidrIp"]}],
                    "IpProtocol": permission["IpProtocol"]
                })

    for ip_entry in sg_ips_data:
        for cidr in ip_entry["IpRanges"]:
            ip_permission_deny = {
                "FromPort": ip_entry["FromPort"], 
                "ToPort": ip_entry["ToPort"],
                "IpRanges": [{"CidrIp":cidr["CidrIp"]}],
                "IpProtocol": ip_entry["IpProtocol"]
            }
            if (cidr["CidrIp"] not in all_ips):
                remove_permissions.append(ip_permission_deny)
            elif (ip_entry["FromPort"] not in sg_ports["FromPort"] and
                 ip_entry["ToPort"] not in sg_ports["ToPort"]):
                remove_permissions.append(ip_permission_deny)

    for ip in all_ips:
        for i in range(0, len(sg_ports["FromPort"])):
            ip_permission_entry = {
                "FromPort": sg_ports["FromPort"][i], 
                "ToPort": sg_ports["ToPort"][i], 
                "IpRanges": [{"CidrIp":ip}],
                "IpProtocol": "tcp"
            }
            if ip_permission_entry not in sg_ips_list:
                add_permissions.append(ip_permission_entry)

    if remove_permissions:
        print("Removing permissions from SG: %s." % (sg_id))
        remove_sg_permissions(sg_id, remove_permissions, client)
    else:
        print("No rules to remove from SG: %s." % (sg_id))

    if add_permissions:
        print("Adding permissions to SG: %s." % (sg_id))
        add_sg_permissions(sg_id, add_permissions, client)
    else:
        print("No rules to add to SG: %s." % (sg_id))

def add_sg_permissions(sg_id, permissions, client):
    try:
        client.authorize_security_group_ingress(
            GroupId=sg_id,
            IpPermissions=permissions
        )
    except Exception as error:
        print(error)

def remove_sg_permissions(security_group, permissions, client):
    try:
        client.revoke_security_group_ingress(
            GroupId=security_group,
            IpPermissions=permissions
        )
    except Exception as error:
        print(error)
