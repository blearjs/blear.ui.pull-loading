/**
 * 文件描述
 * @author ydr.me
 * @create 2016-04-27 19:19
 */


define(function (require, exports, module) {
    /**
     * @module parent/index
     */

    'use strict';

    var UI = require('../index.js');
    var random = require('../../utils/random.js');
    var keyframe = require('../../core/keyframe.js');
    var Template = require('../../classes/template.js');
    var Draggable = require('../../classes/draggable.js');
    var object = require('../../utils/object.js');
    var time = require('../../utils/time.js');
    var selector = require('../../core/selector.js');
    var modification = require('../../core/modification.js');
    var attribute = require('../../core/attribute.js');
    var layout = require('../../core/layout.js');
    var transform = require('../../core/transform.js');
    var temlate = require('./template.html', 'html');
    var style = require('./style.css', 'css');

    require('../../utils/debug.js');

    var win = window;
    var doc = win.document;
    var bodyEl = doc.body;
    var namespace = UI.UI_CLASS + '-pullLoading';
    var tpl = new Template(temlate);
    var fontFamily = 'f' + random.guid();
    var kfLoading = keyframe.create({
        0: {
            transform: {
                scale: 0.3
            },
            opacity: 0
        },
        1: {
            transform: {
                scale: 1
            },
            opacity: 1
        }
    });
    // 动作：准备拉动
    var ACTION_READY = 0;
    // 动作：拉动取消，方向不对
    var ACTION_CANCEL = 1;
    // 动作：拉动中
    var ACTION_MOVE = 2;
    // 动作：拉动释放
    var ACTION_DROP = 3;
    // 距离：拉动一点
    var LENGTH_LITTLE = 0;
    // 距离：拉动到完整
    var LENGTH_COMPLETE = 1;
    var defaults = {
        /**
         * 容器区域
         * @type HTMLElement|String|null
         */
        containerEl: null,

        /**
         * 内容区域
         * @type HTMLElement|String|null
         */
        contentEl: null,

        /**
         * 是否显示顶部刷新按钮
         * @type Boolean
         */
        top: true,

        /**
         * 是否显示底部刷新按钮
         * @type Boolean
         */
        bottom: false,

        /**
         * 拉动偏移量
         * @type Number
         */
        offset: 10,

        /**
         * 全程比例，占箭头高度比
         * @type Number
         */
        completeRate: 1,

        /**
         * 运行默认滚动的超时时间
         * @type Number
         */
        allowDefaultTimeout: 500
    };
    var PullLoading = UI.extend({
        className: 'PullLoading',
        constructor: function (options) {
            var the = this;

            options = object.assign(true, {}, defaults, options);
            the.Super();

            // init node
            var containerEl = selector.query(options.containerEl)[0] || bodyEl;
            var contentEl = the[_contentEl] = selector.query(options.contentEl)[0];
            var htmlTop = tpl.render({type: 'top'});
            var indicatorEl = the[_indicatorEl] = modification.parse(htmlTop);
            var directionEl = the[_directionEl] = selector.query('.' + namespace + '-direction', indicatorEl)[0];
            var loadingEl = the[_loadingEl] = selector.query('.' + namespace + '-loading', indicatorEl)[0];

            modification.insert(indicatorEl);
            the[_indicatorRotate] = 0;
            the[_draggable] = new Draggable({
                containerEl: containerEl,
                axis: 'y',
                shadow: false,
                draggable: false,
                preventDefault: true
            });

            var outerHeight = layout.outerHeight(indicatorEl);
            var loadingHeight = layout.outerHeight(loadingEl);
            var indicatorStartTranslateY = -outerHeight + loadingHeight;
            var indicatorEndTranslateY = 0;
            var indicatoDirectionHeight = the[_indicatorDirectionHeight] = outerHeight - loadingHeight;
            var indicatorLoadingHeight = the[_indicatorLoadingHeight] = loadingHeight;
            var indicatorMaxTranslateY = indicatoDirectionHeight + options.offset;
            the[_preventDefaultTimer] = 0;


            the[_onPullReady]();
            the[_actionState] = ACTION_READY;
            the[_lengthState] = LENGTH_LITTLE;

            // 拖拽开始
            the[_draggable].on('dragStart', function () {
                var scrollTop = layout.scrollTop(containerEl);

                if (scrollTop > 0) {
                    the[_actionState] = ACTION_CANCEL;
                    the[_draggable].allowDefault();
                    clearTimeout(the[_preventDefaultTimer]);
                    return;
                }

                if (the[_actionState] !== ACTION_READY) {
                    clearTimeout(the[_preventDefaultTimer]);
                    return;
                }

                the[_onPullReady]();
                the[_lengthState] = LENGTH_LITTLE;
                the[_actionState] = ACTION_MOVE;
                the.emit('pullStart');
            });

            // 拖拽移动
            the[_draggable].on('dragMove', function (pos) {
                var deltaY = pos.deltaY;

                if (the[_actionState] === ACTION_CANCEL) {
                    return;
                }

                // 向上滑动
                if (deltaY < 0) {
                    layout.scrollTop(containerEl, -deltaY);
                    the[_actionState] = ACTION_CANCEL;
                    return false;
                }

                attribute.style(contentEl, {
                    transform: {
                        translateY: deltaY
                    }
                });
                indicatorEndTranslateY = indicatorStartTranslateY + deltaY;
                attribute.style(indicatorEl, {
                    transform: {
                        translateY: indicatorEndTranslateY
                    }
                });

                if (deltaY > indicatorMaxTranslateY * options.completeRate) {
                    if (the[_lengthState] !== LENGTH_COMPLETE) {
                        the[_lengthState] = LENGTH_COMPLETE;
                        the[_onPullChange]();
                        the.emit('pullComplete');
                    }
                } else {
                    if (the[_lengthState] !== LENGTH_LITTLE) {
                        the[_lengthState] = LENGTH_LITTLE;
                        the[_onPullChange]();
                    }
                }
            });

            // 拖拽结束
            the[_draggable].on('dragEnd', function (pos) {
                if (the[_actionState] === ACTION_CANCEL) {
                    if (!layout.scrollTop(containerEl)) {
                        the[_draggable].preventDefault();
                        the[_actionState] = ACTION_READY;
                    }
                    //the[_preventDefaultTimer] = setTimeout(function () {
                    //    the[_draggable].preventDefault();
                    //    the[_actionState] = ACTION_READY;
                    //}, options.allowDefaultTimeout);
                    return false;
                }

                the[_actionState] = ACTION_DROP;

                // 完整拖动
                if (the[_lengthState] === LENGTH_COMPLETE) {
                    the[_onLoadingStart]();
                    the.emit('loadingStart', function () {
                        the[_onLoadingEnd]();
                        the[_actionState] = ACTION_READY;
                        the.emit('loadingEnd');
                    });
                    attribute.show(loadingEl);
                } else {
                    the[_actionState] = ACTION_READY;
                    the[_onLoadingEnd]();
                }

                the.emit('pullEnd');
            });
        },


        destroy: function () {
            var the = this;

            the[_draggable].destroy();
            clearTimeout(the[_preventDefaultTimer]);
        }
    });
    var _actionState = PullLoading.sole();
    var _lengthState = PullLoading.sole();
    var _draggable = PullLoading.sole();
    var _indicatorRotate = PullLoading.sole();
    var _contentEl = PullLoading.sole();
    var _indicatorEl = PullLoading.sole();
    var _directionEl = PullLoading.sole();
    var _loadingEl = PullLoading.sole();
    var _indicatorDirectionHeight = PullLoading.sole();
    var _indicatorLoadingHeight = PullLoading.sole();
    var _onPullReady = PullLoading.sole();
    var _onPullLittle = PullLoading.sole();
    var _onPullChange = PullLoading.sole();
    var _onPullLoading = PullLoading.sole();
    var _onLoadingStart = PullLoading.sole();
    var _onLoadingEnd = PullLoading.sole();
    var _preventDefaultTimer = PullLoading.sole();
    var pro = PullLoading.prototype;


    /**
     * 准备拖动
     */
    pro[_onPullReady] = function () {
        var the = this;

        attribute.style(the[_indicatorEl], {
            transform: {
                translateY: -the[_indicatorDirectionHeight]
            }
        });
        attribute.hide(the[_loadingEl]);
    };


    /**
     * 拉动变化
     */
    pro[_onPullChange] = function () {
        var the = this;

        the[_indicatorRotate] += 180;
        attribute.style(the[_directionEl], {
            transform: {
                rotate: the[_indicatorRotate]
            }
        });
    };


    /**
     * 显示 loading
     */
    pro[_onPullLoading] = function () {
        var the = this;

        transform.transit(the[_directionEl], {
            transform: {
                rotate: 180
            }
        }, {
            duration: 100
        });
    };


    /**
     * 加载开始
     */
    pro[_onLoadingStart] = function () {
        var the = this;

        attribute.style(the[_contentEl], {
            transform: {
                translateY: the[_indicatorLoadingHeight]
            }
        });
        attribute.style(the[_indicatorEl], {
            transform: {
                translateY: -the[_indicatorDirectionHeight]
            }
        });
    };

    /**
     * 加载结束
     */
    pro[_onLoadingEnd] = function () {
        var the = this;

        attribute.style(the[_contentEl], {
            transform: {
                translateY: 0
            }
        });
        attribute.style(the[_indicatorEl], {
            transform: {
                translateY: -the[_indicatorDirectionHeight] - the[_indicatorLoadingHeight]
            }
        });
    };

    style += '@font-face {' +
            /**/'font-family: "' + fontFamily + '";' +
            /**/"src: url('" + require('iconfont.eot?t=1461757799', 'file') + "');" +
            /**/"src: url('" + require('iconfont.eot', 'file') + "?t=1461757799#iefix') format('embedded-opentype')," +
            /**/"url('" + require('iconfont.woff', 'file') + "?t=1461757799') format('woff')," +
            /**/"url('" + require('iconfont.ttf', 'file') + "?t=1461757799') format('truetype')," +
            /**/"url('" + require('iconfont.svg', 'file') + "?t=1461757799#iconfont') format('svg'); " +
        '}' +
        '.' + namespace + '-direction{' +
            /**/'font-family:' + fontFamily + ';' +
        '}' +
        '.' + namespace + '-loading-item{' +
            /**/'-webkit-animation-name:' + kfLoading + ';' +
            /**/'animation-name:' + kfLoading + ';' +
        '}';
    coolie.importStyle(style);
    PullLoading.defaults = defaults;
    module.exports = PullLoading;
});