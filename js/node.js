/**
 * A node class for use with a REST based frontend for Drupal 8
 */


function hal_type(hal_obj) {
    bugme.assert(hal_obj._links, "Object is not a hal object\n" + bugme.dump(hal_obj));
    bugme.assert(hal_obj._links.type, "HAL object invalid. Has no type declaration" + bugme.dump(hal_obj));

    if (hal_obj._links.type.href === c_web_site + '/rest/type/node/' + c_type_lie) {
        return 'Node';
    }
    if (hal_obj._links.type.href === c_web_site + '/rest/type/file/file') {
        return 'File';
    }
    if (hal_obj._links.type.href === c_web_site + '/rest/type/user/user') {
        return 'User';
    }
    return 'Unknown';
}


const node_hal_tpl = (function IIFE() {
    var tpl = {
        type: [{target_id: c_type_lie}],
        title: [{value: null}],
        _links: {
            type: {
                href: c_web_site + '/rest/type/node/' + c_type_lie
            }
        },
        _embedded: {}
    };
    //tpl._links.type[c_web_site + '/rest/relation/node/' + c_type_lie + '/' + c_field_img] = [{href: null}];
    tpl._embedded[c_web_site + '/rest/relation/node/' + c_type_lie + '/' + c_field_img] = [{
        _links: {
            self: {href: null},
            //       type: {href: c_web_site + '/rest/type/file/file'}
        },
        //   uuid: [{value: null}],
        //   uri: [{value: null}]
    }];
    return tpl;
})();

const file_hal_tpl = (function IIFE() {
    return {
        _links: {
            type: {
                href: c_web_site + '/rest/type/file/image'
            }
        },
        filename: [{
            value: ''
        }],
        data: [{
            value: ''
        }]
    };
})();

function Node(i_node) {
    bugme.assert(typeof(i_node) === "object", "Invalid parameter when initializing Node\n" + bugme.dump(i_node));
    // i_node is an object with one of the following setups
    // 1) A full hal object (no callback possible, instantly ready)
    // 2) title, img_uri (defaults to null), img_uuid (defaults to null), cb (optional)
    // 3) nid, cb (optional)

    // Private vars
    var self = this;
    var _node_hal = null;
    var _ready = false;

    // Private consts
    const _submit_node_uri = c_web_site + '/entity/node?' + c_response_format;
    const _get_node_uri = c_web_site + '/node/';
    const _img_field = c_web_site + '/rest/relation/node/' + c_type_lie + '/' + c_field_img;
    const _user_field = c_web_site + '/rest/relation/node/' + c_type_lie + '/uid';

    // Private functions
    var _always_cb = i_node.cb ? i_node.cb : function () {
    };

    var _get_created = function () {
        var ret_val = _node_hal.created ? _node_hal.created[0].value : 0;
        //bugme.log("Created: " + ret_val);
        return ret_val;
    };

    var _success_get = function (response) {
        if (typeof(response) === 'object' && response._links) {
            _node_hal = response;
            _ready = true;
        } else {
            alert("Error loading story from webb");
            throw (new Error("There's no such story... Now, who lied!?"));
        }
        _always_cb();
    };

    var _success = function (msg) {
        bugme.log('Success');
        bugme.log(msg);
        _ready = true;
        _always_cb();
    };

    var _fail = function (xhr, err, exception) {
        bugme.log('Fail');
        bugme.log(err);
        bugme.log(exception);
        bugme.log(xhr.getAllResponseHeaders());
        if (err.match(/parsererror/)) {
            return _success("Continue anyway");
        }
        _always_cb(err);
    };

    // Public functions
    this.getTitle = function () {
        return _node_hal.title[0].value;
    };

    this.getImage = function () {
        if (!_node_hal._links[_img_field]) return '';

        var i = _node_hal._embedded[_img_field][0];
        var imgUuidClass = 'image-' + i.uuid[0].value;
        //bugme.log('Generated tag for:' + imgUuidClass);

        $.ajax({
            type: 'GET',
            url: _node_hal._links[_img_field][0].href
        }).done(function (response) {
            bugme.assert(typeof(response) === 'object' && response._links, 'getImage got invalid response:' + bugme.dump(response));
            var imageSrc = response.uri[0].value
                .replace(/public:\/\//, c_web_site + '/sites/default/files/');
            var imgSelector = '.' + imgUuidClass;
            $(imgSelector).attr('src', imageSrc);
        }).fail(function (xhr, err, exception) {
            bugme.log('Failed to get image!');
        });


        return '<img class="item-proof ' + imgUuidClass + '" alt="' + i.alt + '"/>'
    };

    this.getUserId = function () {
        if (!_node_hal._links[_user_field]) {
            var e = {
                name: 'INCOMPATIBLE_FORMAT',
                message: 'Expected field: ' + _user_field,
                data: _node_hal._links
            };
            throw(e);
        }
        var user_link = _node_hal._links[_user_field][0].href;
        var match = user_link.match(/\d+(\?.*)?$/);
        if (!match || match.length === 0) {
            bugme.log(match);
            var e = {
                name: 'INVALID_USER_ID',
                message: 'Can\'t find valid user id, expected numerical match',
                data: user_link
            };
            throw(e);
        }
        return parseInt(match[0]);
    };

    this.getJSON = function () {
        return JSON.stringify(_node_hal);
    };

    this.render = function () {
        return '<div id="' + _get_created() + '" class="item-lie col-lg-8 col-lg-offset-2">'
            + '<div class="item-title"><span>' + self.getTitle() + '</span></div>'
            + self.getImage()
            + '<a href="#" onClick="g_fsm.stalk(' + self.getUserId() + ');">'
            + '<div class="item-liar">Who lied?</div></a>'
            + '</div>';
    };

    this.isReady = function () {
        return _ready;
    };

    // Initialization
    // TODO: Break these out into separate funcs?
    if (i_node._links) {
        // We got all of the object data, probably loaded from a settings key store
        _node_hal = i_node;
        _ready = true;
    } else if (i_node.nid) {
        bugme.assert(typeof(i_node.nid) === "number" && i_node.nid > 0, "Invalid node id supplied");
        // Make an ajax call to load the object from the server
        var load_uri = _get_node_uri + i_node.nid + '?' + c_response_format;
        bugme.log("Load:" + load_uri);
        $.ajax({
            type: 'GET',
            url: load_uri
        }).done(_success_get).fail(_fail);
    } else if (i_node.title) {
        // Create new or edit existing object (eg change password)
        bugme.log('Save a node!');
        _node_hal = node_hal_tpl;
        _node_hal.title[0].value = i_node.title;
        if (i_node._img_hal) {
            _node_hal._links[_img_field] = [{
                href: i_node._img_hal._links.self.href
            }];
            _node_hal._embedded[_img_field] = [{
                uuid: i_node._img_hal.uuid
            }];
        }
        // Make an ajax call to save the object
        bugme.log(_node_hal);
        var userData = JSON.parse(localStorage.getItem(c_userdata_key));
        $.ajax({
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Authorization", g_fsm.user().getAuth());
            },
            headers: {
                'Content-Type': "application/hal+json",
                'X-CSRF-Token': userData.csrf_token
            },
            type: 'POST',
            data: JSON.stringify(_node_hal),
            url: _submit_node_uri
        }).done(_success).fail(_fail);
    } else {
        throw ( new Error("Invalid members of node initializing object") );
    }
}
