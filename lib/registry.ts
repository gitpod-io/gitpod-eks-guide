import * as cdk from '@aws-cdk/core';
import { Bucket, IBucket, BucketEncryption, BlockPublicAccess } from '@aws-cdk/aws-s3';
import { RemovalPolicy } from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import { CfnAccessKey } from '@aws-cdk/aws-iam';

export interface RegistryProps extends cdk.StackProps {
    readonly clusterName: string
    readonly bucketName: string
    readonly createBucket: boolean
}

export class Registry extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: RegistryProps) {
        super(scope, id, props);

        let registryBucket: IBucket;

        if (props.createBucket) {
            registryBucket = new Bucket(this, "RegistryBucket", {
                encryption: BucketEncryption.KMS_MANAGED,
                bucketName: props.bucketName,
                publicReadAccess: false,
                blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
                removalPolicy: RemovalPolicy.RETAIN
            });
        } else {
            registryBucket = Bucket.fromBucketAttributes(this, 'RegistryBucket', {
                bucketArn: `arn:aws:s3:::${props.bucketName}`,
            });
        }

        const GitpodRegistryAccess = new iam.Policy(this, 'RegistryAccess', {
            policyName: 'GitpodS3Access',
            statements: [
                new iam.PolicyStatement({
                    resources: ['*'],
                    actions: [
                        "s3:*",
                    ],
                }),
                new iam.PolicyStatement({
                    resources: [`${registryBucket.bucketArn}`],
                    actions: [
                        "s3:ListBucket",
                        "s3:GetBucketLocation",
                        "s3:ListBucketMultipartUploads"
                    ],
                }),
                new iam.PolicyStatement({
                    resources: [`${registryBucket.bucketArn}/*`],
                    actions: [
                        "s3:PutObject",
                        "s3:GetObject",
                        "s3:DeleteObject",
                        "s3:ListMultipartUploadParts",
                        "s3:AbortMultipartUpload"
                    ],
                }),
            ],
        });

        const storage = new iam.Group(this, 'RegistryStorage', {
            groupName: 'RegistryStorage',
        });
        storage.attachInlinePolicy(GitpodRegistryAccess);

        const userName = `registry-storage-${props.clusterName}`.toLowerCase();
        const user = new iam.User(this, 'GitpodIAMUserS3', {
            userName,
            groups: [storage]
        });

        const accessKey = new CfnAccessKey(this, `${userName}AccessKey`, {
            userName,
        });
        accessKey.node.addDependency(user);

        new cdk.CfnOutput(this, "AccessKeyId", {
            value: accessKey.ref,
            exportName: "AccessKeyId",
        });
        new cdk.CfnOutput(this, "SecretAccessKey", {
            value: accessKey.attrSecretAccessKey,
            exportName: "SecretAccessKey",
        });
    }
}
