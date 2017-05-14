/**
 * State classes for use with a Cordova based app
 */


function State(i_state) {
    bugme.assert(typeof(i_state) == "object", "Invalid parameter when initializing State (basic)\n" + bugme.dump(i_state));
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
    }

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
    bugme.assert(typeof(i_state) == "object", "Invalid parameter when initializing BrowseState\n" + bugme.dump(i_state));
    State.apply(this, arguments);

    // Private vars and consts
    var self = this;
    const list_uri = c_web_site + '/latest-lies';
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
    }

    this.update = function () {
        bugme.log("Browse update");
        spinner.show();
        $.ajax({
            headers: {
                Accept: "application/hal+json"
            },
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
    bugme.assert(typeof(i_state) == "object", "Invalid parameter when initializing StalkState\n" + bugme.dump(i_state));
    bugme.assert(i_state.stalk_uid, "Invalid parameters, missing stalk_uid\n" + bugme.dump(i_state));
    State.apply(this, arguments);

    // Private vars and consts
    var self = this;
    var current_user = this.parent().user();
    var stalk_user = new User({uid: i_state.stalk_uid, cb: _user_cb}); // Load user to stalk
    var user_lies_uri = c_web_site + '/latest-lies-by/'+i_state.stalk_uid;
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
    }

    // Load this users lies
    this.update = function () {
        bugme.log("Stalk update");
        spinner.show();
        $.ajax({
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Authorization", current_user.getAuth());
            },
            headers: {
                Accept: "application/hal+json"
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
    }
}

// Take care of logging in/out or editing preferences
function LoginState(i_state) {
    bugme.assert(typeof(i_state) == "object", "Invalid parameter when initializing LoginState\n" + bugme.dump(i_state));
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
        if (input_alias.val() == input_alias.attr('def_label')) {
            alert('Enter a name. Any name.');
            return false;
        }
        if (input_pass.val() == input_pass.attr('def_label')) {
            alert('Pick a password.');
            return false;
        }
        if (mail === true && input_email.val() == input_email.attr('def_label')) {
            alert('Input a valid email');
            return false;
        }
        return true;
    }


    // Public funcs
    this.name = function () {
        return this.constructor.name;
    }

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

// Take care of snapping and uploading images
function ImageState(i_state) {
    bugme.assert(typeof(i_state) == "object", "Invalid parameter when initializing ImageState\n" + bugme.dump(i_state));
    bugme.assert(i_state.sibling, "ImageState inappropriately called. Missing sibling");
    bugme.log("Created ImageState");
    State.apply(this, arguments);


    // Private consts and vars
    var self = this;
    var sibling = i_state.sibling;
    var form_build_id = null;
    var load_form_count = 0;
    var upload_img_count = 0;
    const max_load_form = 5;
    var spinner = $('#spinner');
    var proof_btn = $('#get-your-proof');
    var proof_elm = $('#your-proof');
    var alive = true;
    var local_img_uri = null;
    const hack_upload_uri = c_web_site + '/hack-upload-form';


    // Private class
    function FormParams() {
        if (!form_build_id) {
            throw(new Error("No sensible img_build_id"));
        }
        this.form_build_id = form_build_id;
        this.form_id = 'hack_upload_form';
        this.op = 'Upload';
    }


    // Private funcs
    function _cleanup() {
        bugme.log("ImageState _cleanup called");
        sibling = null;
        spinner.hide();
    }

    function _upload_image() {
        var img_file_name_matches = local_img_uri.match(/.*\/(\w+\.jpg)/);
        var img_file_name = img_file_name_matches[1];
        bugme.log("File name part of " + local_img_uri + " is img_file_name");

        // Start uploading pic in the background
        var form_params = new FormParams();
        var options = new FileUploadOptions();
        options.fileKey = "files[new_file]";
        options.fileName = img_file_name;
        options.mimeType = "image/jpeg";
        options.headers = {
            Authorization: self.parent().user().getAuth(),
            Host: c_host,
            Connection: "keep-alive",
            Referer: hack_upload_uri
        };

        options.params = form_params;

        bugme.log('' + bugme.dump(options));

        var ft = new FileTransfer();
        ft.upload(
            local_img_uri,
            hack_upload_uri,
            _success_form_upload,
            _fail_form_upload,
            options,
            true // debug!
        );
    }

    function _success(img_uri) {
        bugme.log("Camera success");
        if (!alive) return;
        local_img_uri = img_uri;
        spinner.hide();
        proof_btn.hide();
        proof_elm.attr('src', img_uri);
        proof_elm.show();
        self.done();
    }

    function _fail() {
        bugme.log("Camera fail");
        if (!alive) return;
        spinner.hide();
        self.cancel();
    }

    function _success_form_id(data) {
        if (!alive) return;
        var matches = /name="form_build_id"\s+value="(form-.+?)"/gm.exec(data);
        if (matches && matches.length) {
            form_build_id = matches[1];
            bugme.log('Form build id:' + form_build_id);
        }
        else {
            bugme.log('Bad regex!!!?');
        }
    }

    function _fail_form_id() {
        if (alive) {
            if (++load_form_count <= max_load_form) {
                _fetch_image_upload_form();
            } else {
                alert("Can't reach server, so can't upload image");
            }
        }
    }

    function _success_form_upload(data) {
        if (!alive) return;
        var response = JSON.parse(data.response);
        if (typeof(response) == "object" && response.uuid) {
            sibling.setProof(response, self);
        } else {
            bugme.log("Bad image upload response\n" + bugme.dump(response))
        }
        _cleanup();
    }

    function _fail_form_upload(err) {
        if (!alive) return;
        bugme.log("Failed to upload image:" + err);
        if (++upload_img_count <= max_load_form) {
            _upload_image();
        } else { // Give up
            alert("Failed to upload image after trying " + max_load_form + "\nVery trying indeed");
            _cleanup();
            alive = false;
        }
    }

    function _fetch_image_upload_form() {
        $.ajax({
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Authorization", self.parent().user().getAuth());
            },
            url: hack_upload_uri,
            type: 'GET'
        }).done(_success_form_id).fail(_fail_form_id);
    }


    // Public funcs
    this.name = function () {
        return this.constructor.name;
    }

    this.update = false;

    this.cancel = function (new_state) {
        if (new_state && new_state != c_submit_state) {
            self.parent().switchState({state: new_state});
        } else {
            self.parent().switchState({state: c_submit_state, resume: sibling});
        }
        _cleanup();
    };

    this.done = function () {
        _upload_image();
        self.parent().switchState({state: c_submit_state, resume: sibling});
    };

    // Initialize state
    _fetch_image_upload_form();

    if (navigator.camera && navigator.camera.getPicture) {
        navigator.camera.getPicture(_success, _fail,
            {
                quality: 75,
                destinationType: Camera.DestinationType.FILE_URI,
                sourceType: Camera.PictureSourceType.CAMERA,
                mediaType: Camera.MediaType.PICTURE,
                encodingType: Camera.EncodingType.JPEG,
                targetWidth: 800,
                targetHeight: 800,
                cameraDirection: Camera.Direction.BACK,
                correctOrientation: true,
                saveToPhotoAlbum: false
            });
    } else {
        alert("You lied!\nThere's no camera here...");
    }

    // TODO: Add other desktop platforms here (for debugging)
    if (navigator.platform == "MacIntel") {
        setTimeout(_fail, 500);
    }

    bugme.log("ImageState finished");
}

// Take care of entering and uploading lies
function LieState(i_state) {
    bugme.assert(typeof(i_state) == "object", "Invalid parameter when initializing LieState\n" + bugme.dump(i_state));
    bugme.log("Created LieState");
    State.apply(this, arguments);

    // Private vars
    var self = this;
    var proof = null;
    var spinner = $('#spinner');
    var input_lie = $('#brand-new-lies');
    var btn_tell = $('#tell-the-world');
    var btn_snap = $('#get-your-proof');
    var proof_elm = $('#your-proof');
    var event_sel = "click tap";
    var sibling = null;
    var node = null;
    const proof_base_uri = c_web_site + "/sites/default/files/";


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
        });
        // Show all buttons, and turn off their actions
        $('#tell-a-lie a').each(function () {
            $(this).show();
            $(this).off(event_sel);
        });
        proof_elm.attr('src', proof_elm.attr('def_src'));
        sibling = null;
        bugme.log("LieState _cleanup finished");
    }

    function _verify_input() {
        if (input_lie.val() == input_lie.attr('def_label')) {
            alert('Pleeeeaaaaaase!');
            return false;
        }
        return true;
    }


    // Public funcs
    this.name = function () {
        return this.constructor.name;
    }

    this.setProof = function (i_upload_obj, i_sib) {
        proof = i_upload_obj;
        sibling = i_sib; // Keep around for cleanup
    };

    this.update = false;

    this.cancel = function (new_state) {
        self.parent().switchState({state: new_state?new_state:c_browse_state});
        _cleanup();
    };

    this.done = function () {
        if (!_verify_input()) return;
        spinner.show();

        var node_input = {title: input_lie.val(), cb: _submit_cb};
        if (proof) {
            node_input.img_uri = proof.uri.replace('public://', proof_base_uri);
            node_input.img_uuid = proof.uuid;
        }
        node = new Node(node_input);

        self.parent().switchState({state: c_browse_state});
        _cleanup();
    };

    // Initialize state
    btn_tell.on(event_sel, function () {
        self.done();
        return false;
    });

    btn_snap.on(event_sel, function () {
        self.parent().switchState({state: c_image_state, sibling: self});
        return false;
    });

    spinner.hide();
}





