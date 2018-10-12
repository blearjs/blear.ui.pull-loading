/**
 * 文件描述
 * @author ydr.me
 * @create 2018-10-12 13:24
 * @update 2018-10-12 13:24
 */


'use strict';

var Loading = require('../src/index');

var loading = new Loading();


document.getElementById('open').onclick = function () {
    loading.open();
};
