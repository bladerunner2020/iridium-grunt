/* eslint-disable no-console */

var s = '"version": "1.2.3"\r\n';
var re = /([^-]version['"]?\s*[:=]\s*['"])([0-9a-zA-Z\-_+.]+)/;

var res = re.exec(s);
console.log(res);