// Constants
const c_init_state = 0;
const c_browse_state = 1;
const c_stalk_state = 2;
const c_login_state = 3;
const c_image_state = 4;
const c_submit_state = 5;
const c_max_state = 6;

const c_host = 'lies.hazardous.se';
const c_web_site = 'http://' + c_host;

// Initializing globals
var g_fsm = null;



// This is the Finite State Machine
function FSM(i_platform) {
    var self = this;
    var current_user = null;
    var platform = i_platform;
    var event_sel = "click tap";
    var current_state_id = c_init_state;
    var browse = new BrowseState({parent: self, state: c_browse_state});
    var current_state = null;
    var spinner = $('#spinner');
    var btn_refresh = $('#btn-refresh');
    var btn_back = $('#btn-back');
    var btn_user = $('#btn-user');
    var btn_add = $('#btn-add');
    var logo = $('.lies-logo');


    // Private functions
    function _restricted_check(i_state) {
        if (current_user) {
            return true;
        }
        switch (i_state) {
            case c_stalk_state:
            case c_image_state:
            case c_submit_state:
                return false;
            default:
                return true;
        }
    }

    // params:
    // state,
    // data (for stalk and login states),
    // resume (for coming back to resume from image)
    this.switchState = function (i_switch) {
        bugme.assert(typeof(i_switch) == "object", "FSM.switchState called with inappropriate arguments\n"+bugme.dump(i_switch));
        bugme.assert(i_switch.state && i_switch.state > c_init_state && i_switch.state < c_max_state,
            "FSM.switchState called with invalid state argument");
        spinner.show();
        if (!_restricted_check(i_switch.state)) {
            return self.switchState({
                state: c_login_state,
                data: i_switch
            });
        }

        current_state_id = i_switch.state;

        // TODO: Which is more efficient, creating new a new state object each time we're changing focus?
        // TODO: Or reusing one object of each? A bit worried about memory use vs stale values
        switch (current_state_id) {
            case c_browse_state:
                platform.setPage(c_browse_page);
                current_state = browse;
                current_state.update();
                break;
            case c_stalk_state:
                platform.setPage(c_stalk_page);
                current_state = new StalkState({parent: self, stalk_uid: i_switch.data});
                break;
            case c_login_state:
                platform.setPage(c_login_page);
                current_state = new LoginState({parent: self, data: i_switch.data});
                break;
            case c_image_state:
                current_state = new ImageState({parent: self, sibling: current_state});
                break;
            case c_submit_state:
                platform.setPage(c_submit_page);
                current_state = i_switch.resume ? i_switch.resume : new LieState({parent: self});
                break;
            default:
                // Impossible to reach
        }

        if (current_state_id != c_browse_state) {
            btn_back.show();
        } else {
            btn_back.hide();
        }

        if (current_state.update) {
            btn_refresh.show();
        } else {
            btn_refresh.hide();
        }
    };

    this.setUser = function (user) {
        if (user) {
            current_user = user;
            if (window.localStorage) {
                window.localStorage.setItem('user', current_user.getJSON());
            }
        } else {
            current_user = null;
            if (window.localStorage) {
                window.localStorage.removeItem('user');
            }
        }
    };

    this.user = function () {
        return current_user;
    };

    this.cancel = function () {
        current_state.cancel();
    };

    this.state = function () {
        return current_state;
    }

    this.platform = function () {
        return platform;
    }

    this.stalk = function (uid) { // Convenient short-hand
        self.switchState({state: c_stalk_state, data: uid});
    };

    // Init FSM
    // Bind focus and blur to all input fields
    var _focus_input = function (elm) {
        if ($(this).attr('def_label') == $(this).val()) {
            $(this).val('');
        }
        return false;
    };

    var _blur_input = function (elm) {
        if ($(this).val() == '') {
            $(this).val($(this).attr('def_label'));
        }
        return false;
    };

    $('input').each(function () {
        $(this).on('focus', _focus_input);
        $(this).on('blur', _blur_input);
    });

    // Bind the toolbar buttons here - instead of in index.html
    btn_add.on(event_sel, function () {
        current_state.cancel(c_submit_state);
        return false;
    });
    btn_user.on(event_sel, function () {
        current_state.cancel(c_login_state);
        return false;
    });
    btn_back.on(event_sel, function () {
        current_state.cancel(c_browse_state);
        return false;
    });
    logo.on(event_sel, function () {
        current_state.cancel(c_browse_state);
    });
    btn_refresh.on(event_sel, function () {
        current_state.update();
        return false;
    });

    if (window.localStorage) {
        var user_hal_loaded = JSON.parse(window.localStorage.getItem("user"));
        if (user_hal_loaded != null) {
            current_user = new User(user_hal_loaded);
        }
    }

    document.addEventListener('backbutton', self.cancel, false); // Fix the back button on Android

    // Let's get the show on the road
    self.switchState({state: c_browse_state});
}
