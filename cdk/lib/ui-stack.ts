import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as ivs from 'aws-cdk-lib/aws-ivs';
import { Construct } from 'constructs';

export interface StackProps {
    cdkProps: cdk.StackProps;
    bucket: s3.Bucket;
    cfDistro: cloudfront.CloudFrontWebDistribution;
    channel: ivs.CfnChannel;
    streamkey: ivs.CfnStreamKey;
}

export class UIStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props.cdkProps);
        
        // Upload the frontend to S3
        new s3deployment.BucketDeployment(this, 'DeployFiles', {
            sources: [s3deployment.Source.asset('../web-ui')],
            destinationBucket: props.bucket,
            prune: false,
            distribution: props.cfDistro,
            distributionPaths: ['/index.html', '/clip.js', '/config.json', '/style.css']
        });
        
        
        new cdk.CfnOutput(this, 'url', { value: 'https://' + props.cfDistro.distributionDomainName });
        new cdk.CfnOutput(this, 'ingestserver', { value: 'rtmps://' +  props.channel.attrIngestEndpoint + ':443/app/'});
        new cdk.CfnOutput(this, 'streamkey', { value: props.streamkey.attrValue });
        
    }
    
}