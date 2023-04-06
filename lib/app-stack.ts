import * as cdk from "aws-cdk-lib";
import * as sns from "aws-cdk-lib/aws-sns";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface AppStackProps extends cdk.StackProps {
  stage: string;
  service: string;
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const createPost = new lambda.Function(this, "CreatePost", {
      code: lambda.Code.fromAsset("./src/SgBlogApi.CreatePost/bin/Release/net7.0/linux-x64/native"),
      handler: "bootstrap",
      functionName: `${this.stackName}-CreatePost`,
      runtime: lambda.Runtime.PROVIDED_AL2,
      architecture: lambda.Architecture.X86_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      environment: {
        SERVICE: props.service,
        STAGE: props.stage,
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    new logs.LogGroup(this, "CreatePostLogGroup", {
      logGroupName: `/aws/lambda/${createPost.functionName}`,
      retention: props.stage === "prod" ? logs.RetentionDays.ONE_YEAR : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const api = new apigateway.RestApi(this, "ApiGateway", {
      restApiName: this.stackName,
      deployOptions: {
        stageName: "LIVE",
        tracingEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
        maxAge: cdk.Duration.seconds(60),
      },
      cloudWatchRole: false,
    });

    const v1 = api.root.addResource("v1");
    const posts = v1.addResource("posts");
    posts.addMethod("POST", new apigateway.LambdaIntegration(createPost));
  }
}
