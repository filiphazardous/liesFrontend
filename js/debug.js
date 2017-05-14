// Create a namespace for debugging
var bugme = {};
bugme.enable = true;

// Log if debug is set, otherwise no-op
bugme.log = bugme.enable ? function  (msg) {
    console.log(msg);
} : function () {
};

// Simple assert
// Borrowed from: http://stackoverflow.com/questions/15313418/javascript-assert
bugme.assert = bugme.enable ? function (condition, message) {
    if (!condition) {
        message = message || "Assertion failed";
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        throw message;
    }
} : function () {
};

/**
 * Function : dump()
 * Arguments: The data - array,hash(associative array),object
 *    The max number of levels to iterate - OPTIONAL
 *    The current level - OPTIONAL, internal use
 * Returns  : The textual representation of the array.
 * This function was inspired by the print_r function of PHP.
 * This will accept some data as the argument and return a
 * text that will be a more readable version of the
 * array/hash/object that is given.
 * Docs: http://www.openjs.com/scripts/others/dump_function_php_print_r.php
 * Current version improved by filip@blueturtle.nu to add max levels
 */

bugme.dump = bugme.enable ? function (arr, max_level_param, level) {
    var max_level = max_level_param ? max_level_param : 2;
    var dumped_text = "";
    if (!level) level = 0;
    if (level > max_level) return ""+typeof(arr)+"\n";

    //The padding given at the beginning of the line.
    var level_padding = "";
    for (var j = 0; j < level + 1; j++) level_padding += "    ";

    if (typeof(arr) == 'object') { //Array/Hashes/Objects
        for (var item in arr) {
            var value = arr[item];
            if (typeof(value) == 'object') { //If it is an array,
                dumped_text += level_padding + "'" + item + "' ...\n";
                dumped_text += bugme.dump(value, max_level, level + 1);
            } else if (typeof(value) != 'undefined') {
                dumped_text += level_padding + "'" + item + "' => \"" + value + "\"\n";
            }
        }
    } else { //Stings/Chars/Numbers etc.
        dumped_text = level_padding + "=> " + arr + " :(" + typeof(arr) + ")";
    }
    return dumped_text;
} : function () {
};