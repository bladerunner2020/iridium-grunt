/* global IR */

var appVersion = '{{ VERSION }}';
var buildVersion = '{{ BUILD_VERSION }}';
var fullVersion = '{{ VERSION }}-{{ BUILD_VERSION }}';

IR.SetVariable('Global.AppVersion', appVersion);
IR.SetVariable('Global.BuildVersion', buildVersion);

IR.Log('Starting app.js');
IR.Log('appVersion" ' + appVersion);
IR.Log('buildVersion" ' + buildVersion);
IR.Log('fullVersion" ' + fullVersion);
