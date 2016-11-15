/*
 * Copyright 2016 EBPI (https://www.ebpi.nl)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
(function ($) {
    // Add the multiSelect-function to jQuery
    $.fn.multiSelect = function (config) {
        // Input param is an updated select element we need to reattach to
        $(this).each(function () {
            var originalSelect = $(this);
            // Hide the original element so the user can focus instead on the palette component we'll render into the page
            originalSelect.hide();
            if (originalSelect.prop("tagName").toLowerCase() == "select") {
                var id = originalSelect.attr('id') + "_multiselect";
                if (config == null) {
                    // No config object passed in, this means it's called from AJAX. Wicket will have replaced the
                    // original select in the DOM and now we need to reattach to the new select object
                    reattach(originalSelect, $("#" + id));
                } else {
                    // Parameter is a configuration object, initialize the multiselect for the given select elements...

                    // Start by parsing the original options and created an array of Javascript objects from it
                    var options = parseOptions(originalSelect);

                    // Generate the markup for the multi-select and inject it into the page right after the original select element
                    var markup = createMarkup(id, options, config);
                    originalSelect.after(markup);

                    // Retrieve the newly created multiSelect element by its id and store some properties on it for later use
                    var multiSelect = $("#" + id);
                    multiSelect.prop("originalSelect", originalSelect);
                    multiSelect.prop("options", options);

                    // Setup web-worker for this component. The Webworker will handle longer-running background tasks such as filtering so the
                    // main UI thread stays responsive
                    if(window.Worker) {
                        console.log("Spawning new WebWorker for MultiSelect " + originalSelect.attr("id"));
                        var worker = new Worker(config.workerScript);
                        worker.onmessage = function(evt) {
                            onMessageFromWorker(multiSelect, evt);
                        };
                        worker.busy = false;

                        multiSelect.prop("worker", worker);
                        multiSelect.prop("tasks", []);
                    }

                    // Add dblClick handlers on the ordered lists
                    multiSelect.find("ol").dblclick(function (evt) {
                        doubleClickedList(multiSelect, evt, config);
                    }).click(function (evt) {
                        clickedList(multiSelect, evt, config);
                    });

                    // Add click-handlers for buttons
                    if (config.allowOrder) {
                        multiSelect.find("button.multi-select-button-move-up").click(function (evt) {
                            moveSelectionUp(multiSelect, evt, config);
                        });
                        multiSelect.find("button.multi-select-button-move-down").click(function (evt) {
                            moveSelectionDown(multiSelect, evt, config);
                        });
                    }
                    if (config.allowMoveAll) {
                        multiSelect.find("button.multi-select-button-add-all").click(function (evt) {
                            addAll(multiSelect, evt, config);
                        });
                        multiSelect.find("button.multi-select-button-remove-all").click(function (evt) {
                            removeAll(multiSelect, evt, config);
                        });
                    }
                    multiSelect.find("button.multi-select-button-add").click(function (evt) {
                        addSelectedChoices(multiSelect, evt, config);
                    });
                    multiSelect.find("button.multi-select-button-remove").click(function (evt) {
                        removeSelection(multiSelect, evt, config);
                    });

                    // Add keydown listeners to selects
                    multiSelect.find(".multi-select-choices ol.multi-select-list").keydown(function (evt) {
                        if (evt.which == 32) {
                            addSelectedChoices(multiSelect, evt, config);
                        }
                    });
                    multiSelect.find(".multi-select-selection ol.multi-select-list").keydown(function (evt) {
                        if (evt.which == 32) {
                            removeSelection(multiSelect, evt, config);
                        }
                    });

                    // Add listeners to respond to changing search-filters
                    multiSelect.find("input.filter").keyup(function() {
                        doFilter(multiSelect, $(this));
                    });

                    // Add click-listeners on buttons that clear their search field
                    multiSelect.find("button.multi-select-clear-filter").click(function(evt) {
                        clearFilter(multiSelect, $(this), evt);
                    });

                    // Properly position the buttons inside their container
                    var buttonDiv = multiSelect.find(".multi-select-buttons");
                    var numButtons = buttonDiv.find("button").length;
                    var buttonsSize = numButtons * 40;
                    var fullSize = parseInt(config.vertical ? multiSelect.width() : multiSelect.height());
                    var margin = parseInt((fullSize - buttonsSize) / 2);
                    var ie = navigator.userAgent.indexOf("MSIE ") > -1 || navigator.userAgent.indexOf("Trident/") > -1;
                    if(!config.vertical) {
                        // Horizontal layout, we need to put a margin-top in the button panel te vertically align them
                        buttonDiv.css("margin-top", margin + "px").height((fullSize - margin) + "px");
                    } else if(ie) {
                        // Vertical layout and IE as browser, we need to put a margin-left in the button panel te horizontally align them
                        buttonDiv.css("margin-left", margin + "px").width((fullSize - margin) + "px");
                    }
                }
            }
        });

        // Extract the options from the original select element in the page and convert them into an array of Javascript objects
        function parseOptions(originalSelect) {
            var result = [];
            var originalOptions = originalSelect.find("option");
            for(var i = 0; i < originalOptions.length; i++) {
                var originalOption = $(originalOptions[i]);
                var label = originalOption.text();
                var index = originalOption.attr("data-index");
                result[i] = {
                    index: index,                // Original index to use for ordering choices
                    order: index,                // Order inside selection list, can be altered. Initialized to same as index
                    value: originalOption.val(), // The value that identifies an option
                    label: label,                // The display label for an option
                    inSelection: originalOption.is(":selected"), // Indicates if option is in the selection list (true) or in the choices list (false)
                    selected: false              // Indicates if the user has highlighted this option
                };
                var filterText = originalOption.attr("data-filter-text");
                if(filterText) {
                    result[i].filterText = filterText; // If a list of filter words is available, it is added to the option as well
                }
            }
            return result;
        }

        // This generates the markup to include into the page
        function createMarkup(id, options, config) {
            // Get localized texts or provide defaults
            var localizedText = config.localizedText;
            if(!localizedText) {
                localizedText = {
                    clearFilterTitle:"Clear filter",
                    moveUpTitle:"Move selection up",
                    addAllTitle:"Add all",
                    addTitle:"Add selected choices",
                    removeTitle:"Remove selection",
                    removeAllTitle:"Remove all",
                    moveDownTitle:"Move selection down"
                };
            }

            // Open the palette container with the proper CSS class names
            var markup = "<div id=\"" + id + "\" class=\"multi-select ";
            markup += (config.vertical ? "multi-select-vertical" : "multi-select-horizontal");
            if (config.customClass) {
                markup += " " + config.customClass;
            }
            markup += "\">";

            // Render the choices box
            markup += createListPanelMarkup(config, options, false, localizedText);

            // Render the buttons
            markup += createButtonPanelMarkup(config, localizedText);

            // Render the selection box
            markup += createListPanelMarkup(config, options, true, localizedText);

            // Close Palette container
            markup += "</div>";
            return markup;
        }

        // Generates the markup for either the left or right side of the Palette, which contains a list of available choices (selected = false) or
        // of the currently selected items (selected = true)
        function createListPanelMarkup(config, options, selected, localizedText) {
            var markup = "<div class=\"" + (selected ? "multi-select-selection" : "multi-select-choices") + "\">";
            if (config.filter) {
                // Include the search filter
                markup += "<div class=\"multi-select-filter-panel\">";
                markup += "<input type=\"text\" class=\"filter\" maxlength=\"255\" />";
                markup += "<button class=\"multi-select-clear-filter\" title=\"" + localizedText.clearFilterTitle + "\" />";
                markup += "</div>";
            }
            markup += "<ol class=\"multi-select-list\" tabindex=\"0\">" + createOptionsMarkup(options, selected) + "</ol>";
            markup += "</div>";
            return markup;
        }

        // Creates the markup for the options inside an ordered list
        function createOptionsMarkup(options, selected) {
            var markup = "";
            for(var i = 0; i < options.length; i++) {
                var option = options[i];
                if(selected == option.inSelection) {
                    markup += createOptionMarkup(option);
                }
            }
            return markup;
        }

        function createOptionMarkup(option) {
            var markup = "<li data-value=\"" + option.value + "\" data-index=\"" + option.index + "\" data-order=\"" + option.order + "\"";
            if(option.filterText) {
                markup += " data-filter-text=\"" + option.filterText + "\"";
            }
            if(option.selected) {
                markup += " selected=\"selected\"";
            }
            return markup + ">" + option.label + "</li>";
        }

        // Creates the markup for the panel containing all Palette buttons
        function createButtonPanelMarkup(config, localizedText) {
            var markup = "<div class=\"multi-select-buttons\">";
            if (config.allowOrder) {
                markup += "<button class=\"multi-select-button-move-up\" title=\"" + localizedText.moveUpTitle + "\" disabled=\"disabled\"/>";
            }
            if (config.allowMoveAll) {
                markup += "<button class=\"multi-select-button-add-all\" title=\"" + localizedText.addAllTitle + "\"/>";
            }
            markup += "<button class=\"multi-select-button-add\" title=\"" + localizedText.addTitle + "\" disabled=\"disabled\"/>";
            markup += "<button class=\"multi-select-button-remove\" title=\"" + localizedText.removeTitle + "\" disabled=\"disabled\"/>";
            if (config.allowMoveAll) {
                markup += "<button class=\"multi-select-button-remove-all\" title=\"" + localizedText.removeAllTitle + "\"/>";
            }
            if (config.allowOrder) {
                markup += "<button class=\"multi-select-button-move-down\" title=\"" + localizedText.moveDownTitle + "\" disabled=\"disabled\"/>";
            }
            markup += "</div>";
            return markup;
        }

        function clickedList(multiSelect, evt, config) {
            var evtTarget = evt.target;
            var clickedItem = $(evtTarget);
            if(evtTarget.tagName == 'LI') {
                var clickedValue = clickedItem.attr("data-value");
                var clickedOption = findOptionWithValue(multiSelect, clickedValue);
                if(clickedOption) {
                    var enclosingList = clickedItem.parent();
                    var enclosingDiv = enclosingList.parent();
                    var enclosingDivClass = enclosingDiv.attr("class");
                    var fromChoices = (enclosingDivClass == "multi-select-choices");

                    if(!evt.ctrlKey) {
                        clearSelection(multiSelect, fromChoices);
                    }
                    if(evt.shiftKey) {
                        // TODO: Support click with SHIFT for selecting the previous clicked item till the current one
                    }

                    clickedOption.selected = !clickedOption.selected;
                    if(clickedOption.selected) {
                        clickedItem.addClass("selected");
                    } else {
                        clickedItem.removeClass("selected");
                    }
                    updateStateOfButtons(multiSelect, config);
                }
                evt.preventDefault();
                evt.stopPropagation();
            }
        }

        // Called when a user double clicks on an option in either the choices list or the selection list (default browser behavior)
        function doubleClickedList(multiSelect, evt, config) {
            var evtTarget = evt.target;
            var clickedItem = $(evtTarget);
            if(evtTarget.tagName == 'LI') {
                var clickedValue = clickedItem.attr("data-value");
                var clickedOption = findOptionWithValue(multiSelect, clickedValue);
                if (clickedOption) {
                    var enclosingList = clickedItem.parent();
                    var enclosingDiv = enclosingList.parent();
                    var enclosingDivClass = enclosingDiv.attr("class");
                    var fromChoices = (enclosingDivClass == "multi-select-choices");

                    // Clear the currently highlighted items in the target box we'll be moving the currently clicked item into
                    clearSelection(multiSelect, !fromChoices);

                    // Update status of clicked option
                    clickedOption.selected = true;
                    clickedOption.inSelection = fromChoices;
                    clickedItem.addClass("selected");

                    // Add the option to the other list
                    var target = fromChoices ? ".multi-select-selection" : ".multi-select-choices";
                    var targetList = multiSelect.find(target + " ol.multi-select-list");
                    var targetOrderBy = fromChoices ? "data-order" : "data-index";
                    addOption(clickedItem, targetList, targetOrderBy);
                    selectionChanged(fromChoices ? targetList : enclosingList, multiSelect, config);
                    triggerChange(multiSelect);

                    evt.preventDefault();
                    evt.stopPropagation();
                }
            }
        }

        // Looks through the list of options and return the one with the given value or return null if not found
        function findOptionWithValue(multiSelect, value) {
            var options = multiSelect.prop("options");
            if(options) {
                for(var i = 0 ; i < options.length; i++) {
                    var option = options[i];
                    if(option.value == value) {
                        return option;
                    }
                }
            }
            return null;
        }

        // Clears the currently highlighted items in either the choices list (fromChoices = true) or the selection list (fromChoices = false)
        function clearSelection(multiSelect, fromChoices) {
            // Update all options
            var options = multiSelect.prop("options");
            if(options) {
                for(var i = 0 ; i < options.length; i++) {
                    var option = options[i];
                    if(option.inSelection != fromChoices) {
                        option.selected = false;
                    }
                }
            }

            // Also update the selection in either the choices list or the selection list
            multiSelect.find(fromChoices ? ".multi-select-choices li.selected" : ".multi-select-selection li.selected").removeClass("selected");

            return null;
        }

        // Called when an option should be added at the proper position in either the choices box or the selection box
        function addOption(li, targetList, sortBy) {
            var itemOrder = parseInt(li.attr(sortBy));
            var items = targetList.find("li");
            var moved = false;
            for (var i = 0; i < items.length; i++) {
                var currentItem = $(items[i]);
                var currentOrder = parseInt(currentItem.attr(sortBy));
                if (currentOrder > itemOrder) {
                    li.insertBefore(currentItem);
                    moved = true;
                    break;
                }
            }
            if (!moved) {
                // Move to the end of the select since there was no other elements it should be inserted before
                targetList.append(li);
            }
        }

        // Make sure the original (hidden) select component gets updated if the selection changes
        function selectionChanged(selectionList, multiSelect, config) {
            var originalSelect = multiSelect.prop("originalSelect");
            var originalOptions = originalSelect.find("option");
            originalOptions.removeAttr("selected");

            var selectedItems = selectionList.find("li");
            for (var i = 0; i < selectedItems.length; i++) {
                var val = $(selectedItems[i]).attr("data-value");
                for (var j = 0; j < originalOptions.length; j++) {
                    var current = $(originalOptions[j]);
                    var currentVal = current.val();
                    if (val == currentVal) {
                        current.prop("selected", "selected");
                        break;
                    }
                }
            }
            updateStateOfButtons(multiSelect, config);
        }

        // Called when all options in the choices box should be moved into the selection box
        function addAll(multiSelect, evt, config) {
            if (evt) {
                evt.preventDefault();
                evt.stopPropagation();
            }

            var options = multiSelect.prop("options");
            var selectionList = multiSelect.find(".multi-select-selection ol.multi-select-list");
            var choicesList = multiSelect.find(".multi-select-choices ol.multi-select-list");
            // Clear entire content of choices list
            choicesList.html("");

            // Move all options out of selection and re-create markup for all options to replace existing entries
            var markup = "";
            for(var i = 0; i < options.length; i++) {
                var option = options[i];
                option.inSelection = true;
                option.selected = false;
                option.order = option.index;
                markup += createOptionMarkup(option);
            }
            selectionList.html(markup);
            selectionChanged(selectionList, multiSelect, config);
            triggerChange(multiSelect);
        }

        // Called when all options in the selection box should be removed from the selection
        function removeAll(multiSelect, evt, config) {
            if (evt) {
                evt.preventDefault();
                evt.stopPropagation();
            }

            var options = multiSelect.prop("options");
            var selectionList = multiSelect.find(".multi-select-selection ol.multi-select-list");
            var choicesList = multiSelect.find(".multi-select-choices ol.multi-select-list");
            // Clear entire selection list
            selectionList.html("");

            // Move all options out of selection and re-create markup for all options to replace existing entries
            var markup = "";
            for(var i = 0; i < options.length; i++) {
                var option = options[i];
                option.inSelection = false;
                option.selected = false;
                option.order = option.index;
                markup += createOptionMarkup(option);
            }
            choicesList.html(markup);
            selectionChanged(selectionList, multiSelect, config);
            triggerChange(multiSelect);
        }

        // Called when the selected choices should be moved into the selection box
        function addSelectedChoices(multiSelect, evt, config) {
            if (evt) {
                evt.preventDefault();
                evt.stopPropagation();
            }

            var selectionList = multiSelect.find(".multi-select-selection ol.multi-select-list");
            var choicesList = multiSelect.find(".multi-select-choices ol.multi-select-list");

            // Clear highlighted items in selection box
            clearSelection(multiSelect, false);

            // Move selected choices over to selection box
            var selectedChoices = choicesList.find("li.selected");
            selectedChoices.each(function () {
                var currentItem = $(this);
                addOption(currentItem, selectionList, "data-order");
                var option = findOptionWithValue(multiSelect, currentItem.attr("data-value"));
                if(option) {
                    option.selected = true;
                    option.inSelection = true;
                }
            });
            selectionChanged(selectionList, multiSelect, config);
            triggerChange(multiSelect);
        }

        // Called when all selected items in the selection box should be removed from the selection
        function removeSelection(multiSelect, evt, config) {
            if (evt) {
                evt.preventDefault();
                evt.stopPropagation();
            }

            var selectionList = multiSelect.find(".multi-select-selection ol.multi-select-list");
            var choicesList = multiSelect.find(".multi-select-choices ol.multi-select-list");

            // Clear highlighted items in choices box
            clearSelection(multiSelect, true);

            // Move selection over to choices box
            var selection = selectionList.find("li.selected");
            selection.each(function () {
                var currentItem = $(this);
                addOption(currentItem, choicesList, "data-index");
                var option = findOptionWithValue(multiSelect, currentItem.attr("data-value"));
                if(option) {
                    option.selected = true;
                    option.inSelection = false;
                }
            });
            selectionChanged(selectionList, multiSelect, config);
            triggerChange(multiSelect);
        }

        // This function is called to move the current selection up a spot
        function moveSelectionUp(multiSelect, evt, config) {
            if (evt) {
                evt.preventDefault();
                evt.stopPropagation();
            }

            clearSelectionFilter(multiSelect, config);

            var entireSelection = multiSelect.find(".multi-select-selection ol.multi-select-list li");
            var previous = $(entireSelection[0]);
            for(var i = 1; i < entireSelection.length; i++) {
                var current = $(entireSelection[i]);
                if(!previous.hasClass("selected")) {
                    // previous option is not selected, check current
                    if(current.hasClass("selected")) {
                        // The current option IS selected, so we can move it up by switching the order around
                        swapOrder(multiSelect, previous, current);
                        current.insertBefore(previous);
                        continue;
                    }
                }
                previous = current;
            }

            updateStateOfButtons(multiSelect, config);
            orderChanged(multiSelect);
            triggerChange(multiSelect);
        }

        // This function is called to move the current selection down a spot
        function moveSelectionDown(multiSelect, evt, config) {
            if (evt) {
                evt.preventDefault();
                evt.stopPropagation();
            }

            clearSelectionFilter(multiSelect, config);

            var entireSelection = multiSelect.find(".multi-select-selection ol.multi-select-list li");
            var previous = $(entireSelection[entireSelection.length - 1]);
            for(var i = entireSelection.length - 2; i >= 0; i--) {
                var current = $(entireSelection[i]);
                if(!previous.hasClass("selected")) {
                    // previous option is not selected, check next option up the list
                    if(current.hasClass("selected")) {
                        // The next option IS selected, so we can move it down by switching the order around
                        swapOrder(multiSelect, previous, current);
                        current.insertAfter(previous);
                        continue;
                    }
                }
                previous = current;
            }

            updateStateOfButtons(multiSelect, config);
            orderChanged(multiSelect);
            triggerChange(multiSelect);
        }

        // Simply swaps the data-order attribute of two options
        function swapOrder(multiSelect, item1, item2) {
            var option1Order = item1.attr("data-order");
            item1.attr("data-order", item2.attr("data-order"));
            item2.attr("data-order", option1Order);

            var option1 = findOptionWithValue(multiSelect, item1.attr("data-value"));
            var option2 = findOptionWithValue(multiSelect, item2.attr("data-value"));
            if(option1 && option2) {
                option1Order = option1.order;
                option1.order = option2.order;
                option2.order = option1Order;
            }
        }

        // Called when the order of options has changed, this will update the original select element so the selected element
        // are moved to the start of the list, using the same order as the items in the selection box. This makes sure
        // the selected items are submitted to the server in the right order
        function orderChanged(multiSelect) {
            var originalSelect = multiSelect.prop("originalSelect");
            var originalOptions = originalSelect.find("option:selected");
            var selectedOptions = multiSelect.find(".multi-select-selection ol.multi-select-list li");
            for(var i = selectedOptions.length - 1 ; i >= 0; i--) {
                originalSelect.prepend(findOriginalItem(originalOptions, $(selectedOptions[i]).attr("data-value")));
            }
        }

        // Locates an option with a specific value in the original set of options
        function findOriginalItem(originalOptions, value) {
            for(var i = 0 ; i < originalOptions.length; i++) {
                if(value == originalOptions[i].value) {
                    return $(originalOptions[i]);
                }
            }
        }

        // This function is called to update all buttons of the palette and set them either enabled or disabled based on the current selection
        function updateStateOfButtons(multiSelect, config) {
            var entireSelection = multiSelect.find(".multi-select-selection ol.multi-select-list li");
            var selectedSelection = multiSelect.find(".multi-select-selection ol.multi-select-list li.selected");
            var selectedChoices = multiSelect.find(".multi-select-choices ol.multi-select-list li.selected");

            setEnabled(multiSelect.find("button.multi-select-button-remove"), selectedSelection.length > 0);
            setEnabled(multiSelect.find("button.multi-select-button-add"), selectedChoices.length > 0);

            if (config.allowOrder) {
                setEnabled(multiSelect.find("button.multi-select-button-move-up"), isMoveUpAllowed(entireSelection, selectedSelection));
                setEnabled(multiSelect.find("button.multi-select-button-move-down"), isMoveDownAllowed(entireSelection, selectedSelection));
            }

            if (config.allowMoveAll) {
                var allChoices = multiSelect.find(".multi-select-choices ol.multi-select-list li");
                setEnabled(multiSelect.find("button.multi-select-button-add-all"), allChoices.length > 0);
                setEnabled(multiSelect.find("button.multi-select-button-remove-all"), entireSelection.length > 0);
            }
        }

        // This function is called to enable or disable a button if required
        function setEnabled(btn, enabled) {
            if (enabled) {
                if (btn.is(":disabled")) {
                    btn.removeProp("disabled");
                }
            } else {
                if (!btn.is(":disabled")) {
                    btn.prop("disabled", true);
                }
            }
        }

        // This function is called to determine if the add-all button is enabled
        function isMoveUpAllowed(entireSelection, selectedSelection) {
            var selectedCount = selectedSelection.length;
            if (selectedCount == 0) {
                // No selection, move up not allowed
                return false;
            }
            // We know the number of selected item.. check if they are all at the top
            for (var i = 0; i < selectedCount; i++) {
                if (!$(entireSelection[i]).hasClass("selected")) {
                    // This item is not selected.. so there are items left to move up!
                    return true;
                }
            }
            return false;
        }

        // This function is called to determine if the remove-all button is enabled
        function isMoveDownAllowed(entireSelection, selectedSelection) {
            var selectedCount = selectedSelection.length;
            if (selectedCount == 0) {
                // No selection, move down not allowed
                return false;
            }
            // We know the number of selected item.. check if they are all at the bottom
            for (var i = entireSelection.length - 1; i >= entireSelection.length - selectedCount; i--) {
                if (!$(entireSelection[i]).hasClass("selected")) {
                    // This item is not selected.. so there are items left to move down
                    return true;
                }
            }
            return false;
        }

        // This function is called to trigger a change-event in the original component, so it works properly with Wicket Ajax change behaviors
        function triggerChange(multiSelect) {
            var originalSelect = multiSelect.prop("originalSelect");
            if ("createEvent" in document) {
                var evt = document.createEvent("HTMLEvents");
                evt.initEvent("change", false, true);
                originalSelect[0].dispatchEvent(evt);
            }
            else {
                originalSelect[0].fireEvent("onchange");
            }
        }

        // This function is called when Wicket rewrites the original select-component we're linked to after an AJAX update
        function reattach(newSelect, multiSelect) {
            // Re-attaching multi-select
            if (multiSelect.prop("originalSelect") != newSelect) {
                multiSelect.prop("originalSelect", newSelect);

                // TODO: the choices and selection may have been updated on the server.. we should reload everything to be feature-complete.
                // TODO: For now we simply assume the server will not change the choices nor the selection
                // TODO: You can just regenerate the html for the options of the lists, but make sure you also copy the existing scroll position (if allowed)
            }
        }

        // This function is called when the content of the search field changes and takes care of showing all items that match the
        // search terms and hiding all items that don't match
        function doFilter(multiSelect, filterInput) {
            var enclosingDiv = filterInput.parent().parent();
            var enclosingDivClass = enclosingDiv.attr("class");
            var selected = (enclosingDivClass == "multi-select-selection");
            var filterText = filterInput.val();
            var previousFilterText = filterInput.prop("previousFilterText");

            if(filterText != previousFilterText) {
                enclosingDiv.find("ol.multi-select-list").html("");
                addWorkerTask(multiSelect, {
                    command: "filter",
                    options: multiSelect.prop("options"),
                    selected: selected,
                    filterInput: filterInput.val()
                });
            }
            filterInput.prop("previousFilterText", filterText);
        }

        // Function that gets called to clear the content of the search-field before the given clearFilterButton
        function clearFilter(multiSelect, clearFilterButton, evt) {
            if (evt) {
                evt.preventDefault();
                evt.stopPropagation();
            }
            doFilter(multiSelect, clearFilterButton.parent().find("input.filter").val("").focus());
        }

        // Function that gets called to clear the selection filter of the selection box.
        function clearSelectionFilter(multiSelect, config) {
            if(config.filter) {
                var selectionSelect = multiSelect.find(".multi-select-selection input.filter");
                if(selectionSelect.val()) {
                    // Clear filter
                    selectionSelect.val("");
                    doFilter(multiSelect, selectionSelect);
                }
            }
        }

        // Function that gets called when the background-worker wants to update us about something
        function onMessageFromWorker(multiSelect, evt) {
            var worker = multiSelect.prop("worker");
            var data = evt.data;
            var command = data.command;

            if(command == "ready") {
                worker.busy = false;
                executeNextTask(multiSelect);
            } else if(command == "addOption") {
                var option = data.option;
                if(option) {
                    var list = multiSelect.find(option.inSelection ? ".multi-select-selection ol" : ".multi-select-choices ol");
                    list.append(createOptionMarkup(option));
                }
            }
        }

        function addWorkerTask(multiSelect, task) {
            var tasks = multiSelect.prop("tasks");
            if(tasks && task) {
                var numTasks = tasks.length;
                var command = task.command;
                if(command == "filter") {
                    // A new filter task replaces any of the existing filter tasks and gets highest priority
                    if(numTasks > 0) {
                        var latestExistingTask = tasks[numTasks - 1];
                        if(latestExistingTask.command == command) {
                            // The highest priority task is already a filter-task, replace that one with the new one, since it'll be more up-to-date
                            tasks[numTasks - 1] = task;
                            return;
                        }
                    }
                    // There's no filter-task on the tasks-array yet, add it to the end (highest prio task)
                    tasks[numTasks] = task;
                } else {
                    if(numTasks > 0) {
                        // Insert the new task at index 0
                        tasks.splice(0, 0, task);
                    } else {
                        // There are no tasks yet, simply add it at index 0
                        tasks[0] = task;
                    }
                }
                executeNextTask(multiSelect);
            }
        }

        // If there are more tasks available to process in the background, the next one will be started
        function executeNextTask(multiSelect) {
            var worker = multiSelect.prop("worker");
            var tasks = multiSelect.prop("tasks");
            if(worker && !worker.busy && tasks) {
                // If no task is processing currently we can execute the next task (if any)
                var numTasks = tasks.length;
                if(numTasks > 0) {
                    var task = tasks.splice(numTasks - 1, 1)[0];
                    worker.postMessage(task);
                    worker.busy = true;
                }
            }
        }
    };
})(jQuery);
