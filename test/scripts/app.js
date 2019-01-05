/* global IR */
/* eslint-disable no-unused-vars */

var appVersion = '{{ VERSION }}';
var buildVersion = '{{ BUILD_VERSION }}';
var fullVersion = '{{ VERSION }}-{{ BUILD_VERSION }}';

IR.SetVariable('Global.AppVersion', appVersion);
IR.SetVariable('Global.BuildVersion', buildVersion);
