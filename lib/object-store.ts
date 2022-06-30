import * as cdk from '@aws-cdk/core';
import { Bucket, IBucket, BucketEncryption, BlockPublicAccess } from '@aws-cdk/aws-s3';
import { RemovalPolicy } from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import { CfnAccessKey } from '@aws-cdk/aws-iam';

export interface ObjectStoreProps extends cdk.StackProps {
    readonly clusterName: string
    readonly bucketName: string
    readonly createBucket: boolean
}

export class ObjectStore extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: ObjectStoreProps) {
        super(scope, id, props);

        let bucket: IBucket;

        if (props.createBucket) {
            bucket = new Bucket(this, "ObjectStoreBucket", {
                encryption: BucketEncryption.KMS_MANAGED,
                bucketName: props.bucketName,
                publicReadAccess: false,
                blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
                removalPolicy: RemovalPolicy.RETAIN
            });
        } else {
            bucket = Bucket.fromBucketAttributes(this, 'ObjectStoreBucket', {
                bucketArn: `arn:aws:s3:::${props.bucketName}`,
            });
        }

        const GitpodRegistryAccess = new iam.Policy(this, 'ObjectStoreAccess', {
            policyName: 'GitpodObjectStoreS3Access',
            statements: [
                new iam.PolicyStatement({
                    resources: [`${bucket.bucketArn}`],
                    actions: [
                        // TODO: revise
                        "s3:*",
                        "s3-object-lambda:*"
                    ],
                }),
                new iam.PolicyStatement({
                    resources: [`${bucket.bucketArn}/*`],
                    actions: [
                        // TODO: revise
                        "s3:*",
                        "s3-object-lambda:*"
                    ],
                }),
            ],
        });

        const storage = new iam.Group(this, 'ObjectStoreS3Storage', {
            groupName: `ObjectStoreS3Storage-${props.clusterName}`.toLowerCase(),
        });
        storage.attachInlinePolicy(GitpodRegistryAccess);

        const userName = `object-store-storage-${props.clusterName}`.toLowerCase();
        const user = new iam.User(this, 'GitpodIAMUserObjectStoreS3', {
            userName,
            groups: [storage]
        });

        const accessKey = new CfnAccessKey(this, `${userName}AccessKey`, {
            userName,
        });
        accessKey.node.addDependency(user);

        new cdk.CfnOutput(this, "ObjectStoreAccessKeyId", {
            value: accessKey.ref,
            exportName: "ObjectStoreAccessKeyId",
        });
        new cdk.CfnOutput(this, "ObjectStoreSecretAccessKey", {
            value: accessKey.attrSecretAccessKey,
            exportName: "ObjectStoreSecretAccessKey",
        });
    }
}
