import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayintegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as sam from 'aws-cdk-lib/aws-sam';
import * as ivs from 'aws-cdk-lib/aws-ivs';
import { Construct } from 'constructs';

export interface StackProps {
  cdkProps: cdk.StackProps;
}

export class BackendStack extends cdk.Stack {
  public bucket: s3.Bucket;
  public cfDistro: cloudfront.CloudFrontWebDistribution;
  public channel: ivs.CfnChannel;
  public streamkey: ivs.CfnStreamKey;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props.cdkProps);

    // Lets start by creating the S3 bucket where we will store the captured clips.
    this.bucket = new s3.Bucket(this, "clips-lambda-bucket", {
      websiteIndexDocument: 'index.html',
    })

    // For Cloudfront to access the bucket, we need to create an Origin Access Identity that CloudFront uses to identify itself
    let oai = new cloudfront.OriginAccessIdentity(this, "clips-access");

    // Instead of exposing an S3 bucket publicly (bad), this creates a CloudFront distribution with an S3 Origin Access Identity.
    this.cfDistro = new cloudfront.CloudFrontWebDistribution(this, 'clips-cdn', {
      originConfigs: [{
        behaviors: [{ isDefaultBehavior: true }],
        s3OriginSource: {
          s3BucketSource: this.bucket,
          originAccessIdentity: oai,
        },
      }]
    });

    // clips depends on another published lambda layer for FFmpeg. Lets deploy this layer as a nested stack into our application.
    // Once that is done we capture the output layer version and create a new Lambda Layer based on it for our application.
    let ffmpegLayerSamApp = new sam.CfnApplication(this, 'FFmpegLayer', {
      location: {
        applicationId: 'arn:aws:serverlessrepo:us-east-1:145266761615:applications/ffmpeg-lambda-layer',
        semanticVersion: '1.0.0'
      }
    });

    let layerVersionArn = cdk.Stack.of(this).resolve(ffmpegLayerSamApp.getAtt('Outputs.LayerVersion'))
    let ffmpegLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'FFmpegLayerVersion', layerVersionArn)

    // We can now go ahead and create the Lambda that will generate clips. We pass in the bucket and url so it can return the proper clip path.
    let lambdaFunction = new lambda.Function(this, "clips-backend", {
      runtime: lambda.Runtime.GO_1_X,
      memorySize: 512,
      timeout: cdk.Duration.minutes(5),
      handler: 'bin/clips',
      layers: [ffmpegLayer],
      code: lambda.Code.fromAsset('../bin/clips.zip'),
      environment: {
        "bucket": this.bucket.bucketName,
        "url": this.cfDistro.distributionDomainName
      }
    })

    // The Lambda function needs the ability to write files to S3, so lets grant it PUT access to our bucket.
    lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      sid: "clipswriteaccess",
      effect: iam.Effect.ALLOW,
      actions: [
        "s3:PutObject"
      ],
      resources: [
        this.bucket.bucketArn,
        this.bucket.arnForObjects("*"),
      ]
    }))

    // Our frontend needs a way of calling the Lambda function so lets use a API Gateway in front of the Lambda with a proxy integration for the routes.
    let gw = new apigateway.HttpApi(this, "clips-gateway", {
      apiName: "clips-gw",
    })

    gw.addRoutes({
      path: '/clip',
      methods: [ apigateway.HttpMethod.GET ],
      integration: new apigatewayintegrations.HttpLambdaIntegration('clip-lambdaintegration', lambdaFunction),
    });

    // Create the IVS channel
    this.channel = new ivs.CfnChannel(this, 'clip-channel', {
      latencyMode: 'LOW',
      name: "clip-channel",
    })

    this.streamkey = new ivs.CfnStreamKey(this, "clip-streamkey", {
      channelArn: this.channel.ref,
    })

    new cdk.CfnOutput(this, 'playbackUrl', { value: this.channel.attrPlaybackUrl, exportName: "play" } );
    new cdk.CfnOutput(this, 'api', { value: gw.apiEndpoint, exportName: "api2" });
    

  }
}
  
