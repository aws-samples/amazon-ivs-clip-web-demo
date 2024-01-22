#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from '../lib/backend-stack';
import { UIStack } from '../lib/ui-stack';


const app = new cdk.App();
let backend = new BackendStack(app, 'ClipsBackend', {
  cdkProps: {},
});

let ui = new UIStack(app, 'ClipsUI', {
  cdkProps: {},
  bucket: backend.bucket,
  cfDistro: backend.cfDistro,
  channel: backend.channel,
  streamkey: backend.streamkey,
});
