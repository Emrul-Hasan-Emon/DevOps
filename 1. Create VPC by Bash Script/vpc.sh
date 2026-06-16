# !/bin/bash

REGION="ap-southese-1"

VPC-CIDR="10.10.0.0/16"

ID = $(aws ec2 create-vpc
    --cidr-block $VPC_CIDR
    --region $REGION
    --query 'Vpc.VpcId'
    --output text)

echo "VPC ID: $ID"