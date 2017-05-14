/**
 * State classes for use with a Cordova based app
 */


function State(i_state) {
    bugme.assert(typeof(i_state) === "object", "Invalid parameter when initializing State (basic)\n" + bugme.dump(i_state));
    // i_state is an object with at least the following parameters
    // next_state, is the which this state should transition to when closed (-1 means to save state)
    // parent, is the FSM which arbitrates between states

    // Privates
    var self = this;
    var parent = i_state.parent;


    // Public funcs
    this.parent = function () {
        return parent;
    };

    this.name = function () {
        return this.constructor.name;
    };

    this.update = function () {
        bugme.log("Override function update() in class!");
    };

    this.done = function () {
        bugme.log("Override function done() in class!");
    };

    this.cancel = function () {
        bugme.log("Override function cancel() in class!");
    };
}


// There can only be one! This state is never killed (as long as the app is running)
// Thus, it has no next state - but is simply sleeping when other states are active
function BrowseState(i_state) {
    bugme.assert(typeof(i_state) === "object", "Invalid parameter when initializing BrowseState\n" + bugme.dump(i_state));
    State.apply(this, arguments);

    // Private vars and consts
    var self = this;
    const list_uri = c_web_site + '/latest-lies?' + c_response_format;
    var list_elm = $('#list-of-lies');
    var spinner = $('#spinner');

    // Private funcs
    function _success(response) {
        list_elm.empty();
        for (var i = 0; i < response.length; ++i) {
            var node = new Node(response[i]);
            list_elm.append(node.render());
        }
        self.parent().platform().adjustTitle();
        spinner.hide();
    }

    function _fail(xhr, err, exception) {
        list_elm.empty();
        list_elm.append('<div id="000" class="item-lie">'
        + '<div class="item-title">Somthing broke</div>'
        + '<div class="item-liar">Blame Master Liar</div>'
        + '</div>');
        bugme.log(err);
        spinner.hide();
    }

    // Public funcs
    this.name = function () {
        return this.constructor.name;
    };

    this.update = function () {
        bugme.log("Browse update");
        spinner.show();
        $.ajax({
            type: 'GET',
            url: list_uri
        }).done(_success).fail(_fail);
    };

    this.done = function () {
        self.parent().switchState({state: c_browse_state});
    };

    this.cancel = function (new_state) {
        bugme.log("Browse cancel");
        self.parent().switchState({state: new_state?new_state:c_browse_state});
    };

    // Initialize state
    self.update();
}


// Display all about the individual you want to stalk
function StalkState(i_state) {
    bugme.assert(typeof(i_state) === "object", "Invalid parameter when initializing StalkState\n" + bugme.dump(i_state));
    bugme.assert(i_state.stalk_uid, "Invalid parameters, missing stalk_uid\n" + bugme.dump(i_state));
    State.apply(this, arguments);

    // Private vars and consts
    var self = this;
    var current_user = this.parent().user();
    var stalk_user = new User({uid: i_state.stalk_uid, cb: _user_cb}); // Load user to stalk
    var user_lies_uri = c_web_site + '/latest-lies-by/' + i_state.stalk_uid + '?' + c_response_format;
    var list_elm = $('#list-of-liars-lies');
    var spinner = $('#spinner');

    // Private funcs
    function _user_cb(msg) {
        if (stalk_user.isReady()) {
            list_elm.append(stalk_user.render());
            self.update();
        } else {
            list_elm.append('<p>Error!!!!</p><p>'+msg+'</p>');
            spinner.hide();
        }
    }

    function _cleanup() {
        bugme.log("StalkState _cleanup called");
        list_elm.empty();
    }

    function _success(response) {
        list_elm.empty();
        list_elm.append(stalk_user.render());
        self.parent().platform().adjustTitle();
        for (var i = 0; i < response.length; ++i) {
            var node = new Node(response[i]);
            list_elm.append(node.render);
        }
        self.parent().platform().adjustTitle();
        spinner.hide();
    }

    function _fail(xhr, err, exception) {
        list_elm.empty();
        if (stalk_user && stalk_user.isReady()) {
            list_elm.append(stalk_user.render());
        }
        list_elm.append("<p>Mucho error!</p><p>"+err+"</p>");
        spinner.hide();
    }

    // Public funcs
    this.name = function () {
        return this.constructor.name;
    };

    // Load this users lies
    this.update = function () {
        bugme.log("Stalk update");
        spinner.show();
        $.ajax({
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Authorization", current_user.getAuth());
            },
            type: 'GET',
            url: user_lies_uri
        }).done(_success).fail(_fail);
    };

    this.done = function () {
        bugme.log("Stalk done");
        self.parent().switchState({state: c_browse_state});
        _cleanup();
    };

    this.cancel = function (new_state) {
        bugme.log("Stalk cancel");
        self.parent().switchState({state: new_state?new_state:c_browse_state});
        _cleanup();
    };
}


// Take care of logging in/out or editing preferences
function LoginState(i_state) {
    bugme.assert(typeof(i_state) === "object", "Invalid parameter when initializing LoginState\n" + bugme.dump(i_state));
    State.apply(this, arguments);

    //Private vars and consts
    i_state.parent = null;
    bugme.log("LoginState input\n"+bugme.dump(i_state, 1));
    var self = this;
    var alive = true;
    var current_user = this.parent().user();
    var next_state_data = i_state.data; // i_state data for state that was pre-empted
    var event_sel = "click tap";
    var spinner = $('#spinner');
    var input_alias = $('#register-alias');
    var input_email = $('#register-email');
    var input_pass = $('#register-password');
    var btn_edit = $('#btn-edit-user');
    var btn_create = $('#btn-create-user');
    var btn_login = $('#btn-login');
    var btn_logout = $('#btn-logout');

    // Private funcs
    function _cleanup() {
        bugme.log("LoginState _cleanup called");
        // Reset all input fields
        $('#identity-lies input').each(function () {
            $(this).val($(this).attr('def_label'));
            $(this).off(event_sel);
        });
        // Show all buttons, and turn off their actions
        $('#identity-lies a').each(function () {
            $(this).show();
            $(this).off(event_sel);
        });
        $('#identity-lies button').each(function () {
            $(this).show();
            $(this).off(event_sel);
        });

        alive = false;
    }

    function _verify_input(mail) {
        if (input_alias.val() === input_alias.attr('def_label')) {
            alert('Enter a name. Any name.');
            return false;
        }
        if (input_pass.val() === input_pass.attr('def_label')) {
            alert('Pick a password.');
            return false;
        }
        if (mail === true && input_email.val() === input_email.attr('def_label')) {
            alert('Input a valid email');
            return false;
        }
        return true;
    }


    // Public funcs
    this.name = function () {
        return this.constructor.name;
    };

    this.update = false;

    this.done = function (msg) {
        bugme.log("Login done\n"+msg);
        if (!alive) {
            bugme.log("...called on dead object!");
            return;
        }
        if (current_user) { // Login or create
            if (current_user.isReady()) {
                self.parent().setUser(current_user);
            } else {
                if (msg) alert(msg);
                bugme.log("Login failed");
                return;
            }
        } else { // Logout
            self.parent().setUser(null);
            self.parent().switchState({state: c_browse_state});
            _cleanup();
            return;
        }
        self.parent().switchState(next_state_data ? next_state_data : {state: c_browse_state});
        _cleanup();
    };

    this.cancel = function (new_state) {
        if (!alive) {
            bugme.log("Cancel login called on dead object");
            return;
        }
        self.parent().switchState({state: new_state?new_state:c_browse_state});
        _cleanup();
    };


    // Initialize state
    if (current_user) {
        bugme.log('Initialize state');
        input_alias.val(current_user.getName());
        var mail = current_user.getMail() ? current_user.getMail() : input_email.attr('def_label');
        input_email.val(mail);

        if (btn_edit) {
            btn_edit.on(event_sel, function () {
                alert('Edit settings not implemented');
                return false;
            });
        }

        btn_logout.on(event_sel, function () {
            bugme.log("Button logout pressed");
            current_user = null;
            self.done();
            return false;
        });

        btn_login.hide();
        if (btn_create) {
            btn_create.hide();
        }
    } else {
        btn_login.on(event_sel, function () {
            bugme.log("Button login pressed");
            if (_verify_input()) {
                current_user = new User({name: input_alias.val(), pass: input_pass.val(), cb: self.done});
            }
            return false;
        });

        if (btn_create) {
            btn_create.on(event_sel, function () {
                bugme.log("Button create user pressed");
                if (_verify_input(true)) {
                    current_user = new User({
                        name: input_alias.val(),
                        pass: input_pass.val(),
                        mail: input_email.val(),
                        edit: true,
                        cb: self.done
                    });
                }
                return false;
            });
        }

        if (btn_edit) {
            btn_edit.hide();
        }
        btn_logout.hide();
    }

    spinner.hide();
}


// Take care of entering and uploading lies
function LieState(i_state) {
    bugme.assert(typeof(i_state) === "object", "Invalid parameter when initializing LieState\n" + bugme.dump(i_state));
    bugme.log("Created LieState");
    State.apply(this, arguments);

    // Private vars
    var self = this;
    var proof = null;
    var spinner = $('#spinner');
    var input_lie = $('#brand-new-lies');
    var btn_tell = $('#tell-the-world');
    var proof_input = $('#get-your-proof');
    var proof_elm = $('#your-proof');
    var event_sel = "click tap";
    var node = null;


    // Private funcs
    function _submit_cb(msg) {
        if (!node.isReady()) {
            alert("Failed to submit lie: " + msg);
        }
    }

    function _cleanup() {
        bugme.log("LieState _cleanup called");

        // Reset all input fields
        $('#tell-a-lie input').each(function () {
            $(this).val($(this).attr('def_label'));
            $(this).off('change');
        });

        // Show all buttons, and turn off their actions
        $('#tell-a-lie a').each(function () {
            $(this).show();
            $(this).off(event_sel);
        });

        proof_elm.attr('src', proof_elm.attr('def_src'));

        bugme.log("LieState _cleanup finished");
    }

    function _verify_input() {
        if (input_lie.val() === input_lie.attr('def_label')) {
            alert('Pleeeeaaaaaase!');
            return false;
        }
        return true;
    }


    // Public funcs
    this.name = function () {
        return this.constructor.name;
    };

    this.update = false;

    this.cancel = function (new_state) {
        self.parent().switchState({state: new_state?new_state:c_browse_state});
        _cleanup();
    };

    this.done = function () {
        if (!_verify_input()) return;
        spinner.show();

        var node_input = {
            title: input_lie.val(),
            _img_hal: proof,
            cb: _submit_cb
        };

        node = new Node(node_input);

        self.parent().switchState({state: c_browse_state});
        _cleanup();
    };


    // Initialize state

    btn_tell.on(event_sel, function () {
        self.done();
        return false;
    });

    proof_input.on('change', function () {

        if (!proof_input[0].files || proof_input[0].files.length === 0) return;
        var fileItem = proof_input[0].files[0];
        var _img_hal = file_hal_tpl;
        _img_hal.filename[0].value = fileItem.name;
        var reader = new FileReader();

        reader.onload = function (e) {

            // Assign the binary file data to img src and to the hal object
            proof_elm.attr('src', e.target.result);
            _img_hal.data[0].value = e.target.result.replace(/data\:image\/\w+;base64,/, '');

            // Upload the file
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
                data: JSON.stringify(_img_hal),
                url: c_web_site + '/entity/file?_format=hal_json'
            }).done(function(response){

                bugme.log('Succeded uploading image');
                proof = response;
            }).fail(function(xhr, err){

                bugme.log('Failed to upload image');
                bugme.log(err);
            });
        };

        reader.readAsDataURL(fileItem);
    });

    spinner.hide();
}





