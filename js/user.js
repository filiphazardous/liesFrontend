/**
 * A user class for use with a REST based frontend for Drupal 8
 */


const user_hal_tpl = (function IIFE() {
    var tpl = {
        _links: {type: {href: c_web_site + '/rest\/type\/user\/user'}},
        name: [{value: null}],
        mail: [{value: null}],
        pass: [{value: null}],
        status: [{value: 1}]
    };
    return tpl;
})();


// User is a value object, it will either GET, POST or PATCH on initialization
// and it can't be changed after initialization has finished
function User(i_user) {
    bugme.assert(typeof(i_user) === "object", "Invalid parameter when initializing User\n" + bugme.dump(i_user));
    // i_user is an object with one of the following setups
    // 1) A full hal object (no callback possible, instantly ready)
    // 2) name, mail, pass, edit (defaults to false), method (defaults to POST), cb (optional)
    // 3) name, pass, cb (optional)
    // 4) uid, cb (optional)

    // Private vars
    var self = this;
    var _user_hal = null;
    var _ready = false;

    // Private consts
    const _user_uri = c_web_site + '/entity/user/';

    // Private functions
    var _always_cb = i_user.cb ? i_user.cb : function () {
    };

    var _admin_before_func = function (xhr) {
        xhr.setRequestHeader("Authorization", g_admin_login_base64);
    };

    var _get_pass = function () {
        return _user_hal.pass[0].value;
    };

    var _success_get = function (response) {
        bugme.assert(typeof(response) === "object" && response._links, "There's no such user");
        _user_hal = response;
        _ready = true;
        _always_cb();
    };

    var _success = function (msg) {
        bugme.log(bugme.dump(msg));
        _ready = true;
        _always_cb();
    };

    var _fail = function (xhr, err, exception) {
        bugme.log(err);
        if (err.match(/parsererror/)) {
            bugme.log("Continue anyway");
            return _success("Continue anyway");
        }
        _always_cb(err);
    };

    // Public functions
    this.getName = function () {
        var ret_val = _user_hal.name[0].value;
        bugme.log("Name: " + ret_val);
        return ret_val;
    };

    this.getAuth = function () {
        var ret_val = 'Basic ' + btoa(self.getName() + ':' + _get_pass());
        bugme.log('Auth: ' + ret_val);
        return ret_val;
    };

    this.getMail = function () {
        return _user_hal.mail[0].value;
    };

    this.getJSON = function () {
        return JSON.stringify(_user_hal);
    };

    this.render = function () {
        return '<div class="item-lie"><div class="item-tagline">The Liar is:</div>'
            + '<div class="item-title"><span>' + self.getName() + "</span></div></div>";
    };

    this.isReady = function () {
        return _ready;
    };

    // Initialization
    // TODO: Break these out into separate funcs?
    if (i_user._links) {
        // We got all of the object data, probably loaded from a settings key store
        _user_hal = i_user;
        _ready = true;
    } else if (i_user.edit && i_user.name && i_user.pass && i_user.mail) {
        // Create new or edit existing object (eg change password)
        _user_hal = user_hal_tpl;
        _user_hal.name[0].value = i_user.name;
        _user_hal.mail[0].value = i_user.mail;
        _user_hal.pass[0].value = i_user.pass;

        // Make an ajax call to save the object
        $.ajax({
            beforeSend: _admin_before_func,
            contentType: 'application/hal+json',
            type: i_user.method ? i_user.method : 'POST',
            data: JSON.stringify(_user_hal),
            url: _user_uri + '?' + c_response_format
        }).done(_success).fail(_fail);
    } else if (i_user.uid) {
        // Make an ajax call to load the object from the server
        var auth = g_fsm.user() ? g_fsm.user().getAuth() : self.getAuth();
        var load_uri = c_web_site + '/user/' + i_user.uid + '?' + c_response_format;
        bugme.log(bugme.dump(i_user));
        bugme.log("Load:" + load_uri);
        $.ajax({
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Authorization", auth);
            },
            type: 'GET',
            url: load_uri
        }).done(_success_get).fail(_fail);
    } else if (i_user.name && i_user.pass) {
        // TODO: Come up with a way to get a more complete version of _this_ users data from server as a response
        // A simple login
        _user_hal = user_hal_tpl;
        _user_hal.name[0].value = i_user.name;
        _user_hal.pass[0].value = i_user.pass;

        // Make an ajax call to check the supplied credentials
        var test_dest = c_web_site + '/user/1?' + c_response_format;
        bugme.log('Test dest:' + test_dest);
        $.support.cors = true;
        $.ajax({
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Authorization", self.getAuth());
            },
            //     xhrFields: {
            //       withCredentials: true
            // },
            type: 'GET',
            url: test_dest
        }).done(_success)
            .fail(_fail);
    } else {
        throw(new Error("Invalid members of user object"));
    }
}
