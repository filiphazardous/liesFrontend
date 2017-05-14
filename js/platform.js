// Constants
const c_init_page = 0;
const c_browse_page = 1;
const c_stalk_page = 2;
const c_login_page = 3;
const c_image_page = 4;
const c_submit_page = 5;
const c_max_page = 6;

const c_platform_cordova = 0;
const c_platform_bootstrap = 1;

const g_platform = c_platform_bootstrap;

// Onload for various platforms
switch (g_platform) {
    case c_platform_cordova:
        document.addEventListener('deviceready', function () {
            bugme.log("Device ready");
            g_fsm = new FSM(new CordovaPlatform());
        }, false);

        // Customize alert box
        if (navigator.notification) {
            window.alert = function (txt) {
                navigator.notification.alert(txt, null, "Warning", "Ok");
            }
        }
        break;

    case c_platform_bootstrap:
        $(document).ready(function () {
            bugme.log("document ready");
            g_fsm = new FSM(new BootstrapPlatform());
        });
        $(window).unload(function() {
            // User is logged out, so remove user data
            localStorage.removeItem(c_userdata_key);
        });
        break;

    default:
        bugme.assert(false, "Unknown platform!");
}


function Platform() {
    var self = this;

    self.setPage = function (new_page) {
        bugme.assert(false, "Implement setPage!");
    }
}


function BootstrapPlatform() {
    var self = this;
    Platform.apply(this, arguments);

    if (!window.btoa) window.btoa = $.base64.btoa;
    if (!window.atob) window.atob = $.base64.atob;

    self.setPage = function (new_page) {
        bugme.log("setPage called");
        $(".lies-page").hide();
        switch (new_page) {
            case c_init_page:
            case c_browse_page:
                $("#latest-lies").show();
                break;
            case c_stalk_page:
                $("#check-a-liar").show();
                break;
            case c_login_page:
                $("#identity-lies").show();
                break;
            case c_image_page:
            case c_submit_page:
                $('#tell-a-lie').show();
                break;
            default:
                bugme.assert(false, "Invalid page request");
        }
    }

    self.adjustTitle = function () {
        $("div").textfill({maxFontPixels: 86, widthOnly: true});
    }

    self.supportCors = function () {
        return $.support.cors;
    }

    $(window).resize(function() { self.adjustTitle(); });
}


function CordovaPlatform() {
    var self = this;
    Platform.apply(this, arguments);

    if (!window.btoa) window.btoa = $.base64.btoa;
    if (!window.atob) window.atob = $.base64.atob;

    self.setPage = function (new_page) {
        bugme.log("setPage called");
        switch (new_page) {
            case c_init_page:
            case c_browse_page:
                $.mobile.changePage('#latest-lies', 'slide', true, true);
                break;
            case c_stalk_page:
                $.mobile.changePage('#check-a-liar', 'slide', true, true);
                break;
            case c_login_page:
                $.mobile.changePage('#identity-lies', 'slide', true, true);
                break;
            case c_image_page:
            case c_submit_page:
                $.mobile.changePage('#tell-a-lie', 'slide', true, true);
                break;
            default:
                bugme.assert(false, "Invalid page request");
        }
    }

    self.adjustTitle = function () {
        bugme.log("Not implemented");
    }

    self.supportCors = function () {
        return true;
    }
}