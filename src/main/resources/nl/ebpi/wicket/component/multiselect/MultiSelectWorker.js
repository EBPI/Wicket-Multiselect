onmessage = function(e) {
    var data = e.data;
    var command = data.command;
    var options = data.options;
    var selected = data.selected;
    var filterInput = data.filterInput;

    // Handle command
    if(command == "filter") {
        var filterWords = filterInput ? filterInput.toLowerCase().split(" ") : [];
        for(var i = 0; i < options.length; i++) {
            var option = options[i];
            if(selected == option.inSelection) {
                var filterText = option.filterText;
                if(!filterText) {
                    filterText = option.label.toLowerCase();
                }
                var optionWords = filterText.split(" ");
                var allFound = true;
                for(var j = 0; j < filterWords.length; j++) {
                    var filterWordInOption = false;
                    for(var k = 0; k < optionWords.length; k++) {
                        if(optionWords[k].indexOf(filterWords[j]) >= 0) {
                            filterWordInOption = true;
                            break;
                        }
                    }
                    if(!filterWordInOption) {
                        allFound = false;
                        break;
                    }
                }

                if(allFound) {
                    // Notify the main thead that this option may be added to the select list it is part of
                    postMessage({command: "addOption", option: option});
                }
            }
        }

        postMessage({command:"ready"});
    }
};
