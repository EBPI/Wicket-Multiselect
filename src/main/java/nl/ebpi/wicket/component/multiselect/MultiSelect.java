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
package nl.ebpi.wicket.component.multiselect;

import java.util.List;
import java.util.Set;
import javax.annotation.Nonnull;
import javax.annotation.Nullable;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.event.IEvent;
import org.apache.wicket.markup.head.CssHeaderItem;
import org.apache.wicket.markup.head.IHeaderResponse;
import org.apache.wicket.markup.head.JavaScriptHeaderItem;
import org.apache.wicket.markup.head.OnDomReadyHeaderItem;
import org.apache.wicket.markup.html.form.ListMultipleChoice;
import org.apache.wicket.model.IModel;
import org.apache.wicket.request.cycle.RequestCycle;
import org.apache.wicket.request.handler.resource.ResourceReferenceRequestHandler;
import org.apache.wicket.request.resource.CssResourceReference;
import org.apache.wicket.request.resource.JavaScriptResourceReference;
import org.apache.wicket.request.resource.ResourceReference;
import org.apache.wicket.util.string.AppendingStringBuffer;

/**
 * The MultiSelect component is a component that allows the user to select multiple values from
 * a list of options. If Javascript is enabled, the component will act much like the classic
 * wicket <code>Palette</code> component with some additional features. If no Javascript is enabled,
 * this component falls back to a default HTML multi-select component that is supported in all
 * browsers.
 *
 * @param <T> The type of options that are listed and can be selected by the user.
 * @author Onno Scheffers
 */
public class MultiSelect<T> extends ListMultipleChoice<T> {
    private static final long serialVersionUID = -3383417025214384614L;

    /**
     * Flag that indicates if the selected items can be ordered (moved up/down) by the user.
     */
    private boolean orderAllowed = false;
    /**
     * Flag that indicates if buttons should be shown that select or deselect all options at once.
     */
    private boolean moveAllAllowed = false;
    /**
     * Flag that indicates if the palette should use the vertical style where the selection box is underneath the choices box. If false, the default
     * horizontal layout will be used.
     */
    private boolean vertical = false;
    /**
     * Flag that indicates if client-side filtering should be enabled.
     */
    private boolean filteringAllowed = true;
    /**
     * A custom CSS class that should be assigned to the palette container. This makes it easier to provide specific styling for a specific situation.
     */
    private String customClass;

    /**
     * Constructor.
     *
     * @param wicketId THe Wicket id for this component.
     * @param selectionModel The model used for retrieving or storing the list of selected elements.
     * @param choicesModel The model that returns the list of options a user can choose from.
     * @param choiceRenderer The {@link IMultiSelectChoiceRenderer} to use for extracting the id and label and filter words of an option.
     */
    public MultiSelect(
            @Nonnull final String wicketId,
            @Nonnull final IModel<? extends List<T>> selectionModel,
            @Nonnull final IModel<? extends List<? extends T>> choicesModel,
            @Nonnull final IMultiSelectChoiceRenderer<? super T> choiceRenderer) {
        super(wicketId, selectionModel, choicesModel, choiceRenderer);
        setOutputMarkupId(true);
    }

    /**
     * On a non-AJAX request, this will include the Javascript file and the CSS file for the MultiSelect into the HEAD section of the markup. Then the
     * dynamically generated initialization script for the component is also included into the page as DOM-loaded script.
     *
     * @param response The response object to use for adding JavaScript and CSS to.
     */
    @Override
    public void renderHead(@Nonnull final IHeaderResponse response) {
        AjaxRequestTarget ajaxRequestTarget = RequestCycle.get().find(AjaxRequestTarget.class);
        if (ajaxRequestTarget == null) {
            // Add the jQuery-version that's included with Wicket to page header
            response.render(JavaScriptHeaderItem.forReference(getApplication().getJavaScriptLibrarySettings().getJQueryReference()));

            // Add our custom MultiSelect JavaScript file to the page header if that hasn't been done yet by another MultiSelect instance on the page
            ResourceReference scriptResource = new JavaScriptResourceReference(MultiSelect.class, MultiSelect.class.getSimpleName() + ".js");
            response.render(JavaScriptHeaderItem.forReference(scriptResource, MultiSelect.class.getSimpleName(), true));

            // Retrieve the CSS resource and if there is one, include it in the page header as well
            ResourceReference cssResource = getCssResourceReference();
            if(cssResource != null) {
                response.render(CssHeaderItem.forReference(cssResource));
            }

            // Add the dynamic per-component initialization script that turns this component into a Palette on the client if JavaScript is enabled
            response.render(OnDomReadyHeaderItem.forScript(createInitializationScript()));
        }
    }

    /**
     * Returns the CSS resource reference to include in the page for this component. You can override this method to make it return your custom
     * stylesheet or make it return null to not include any CSS file for this component.
     *
     * @return The CSS resource reference to include in the page or null to not include any CSS file.
     */
    @Nullable
    protected ResourceReference getCssResourceReference() {
        return new CssResourceReference(MultiSelect.class, MultiSelect.class.getSimpleName() + ".css");
    }

    /**
     * Create the custom per-component initialization script that configures how this component will be rewritten into a Palette in the browser.
     *
     * @return The custom per-component initialization script.
     */
    private String createInitializationScript() {
        StringBuilder script = new StringBuilder();
        script.append("$(\"#").append(getMarkupId()).append("\").multiSelect({");

        // Do we need to include a custom CSS class to the generated Palette container?
        String cssClass = escape(getCustomClass());
        if(cssClass != null) {
            script.append("\"customClass\":\"").append(cssClass).append("\",");
        }

        // Determine if the buttons should be visible for ordering the selection or selecting/deselecting all items at once
        script.append("\"allowOrder\":").append(isOrderAllowed()).append(',');
        script.append("\"allowMoveAll\":").append(isMoveAllAllowed());

        // Determine if we should render a palette in vertical layout (defaults to horizontal)
        if(isVertical()) {
            script.append(",\"vertical\":true");
        }

        // Determine if filtering is allowed in the panel, meaning the use gets a textfield that can be used to filter the options
        if(isFilteringAllowed()) {
            script.append(",\"filter\":true");
        }

        ResourceReference scriptResource = new JavaScriptResourceReference(MultiSelect.class, MultiSelect.class.getSimpleName() + "Worker.js");
        String workerScript = RequestCycle.get().urlFor(new ResourceReferenceRequestHandler(scriptResource)).toString();
        script.append(",\"workerScript\":\"").append(workerScript).append('\"');

        // Extract the localized content from the properties file and pass them on to the MultiSelect Javascript
        script.append(",\"localizedText\":{");
        script.append("\"addTitle\":\"").append(escape(getString("add.title"))).append("\",");
        script.append("\"addAllTitle\":\"").append(escape(getString("add.all.title"))).append("\",");
        script.append("\"removeTitle\":\"").append(escape(getString("remove.title"))).append("\",");
        script.append("\"removeAllTitle\":\"").append(escape(getString("remove.all.title"))).append("\",");
        script.append("\"moveUpTitle\":\"").append(escape(getString("move.up.title"))).append("\",");
        script.append("\"moveDownTitle\":\"").append(escape(getString("move.down.title"))).append("\",");
        script.append("\"clearFilterTitle\":\"").append(escape(getString("clear.filter.title"))).append('\"');
        script.append('}');
        script.append("});");

        return script.toString();
    }

    /**
     * Turns a text String into a String that can be safely used inside an HTML attribute.
     *
     * @param text The text to escape.
     * @return The escaped text.
     */
    @Nullable
    private String escape(@Nullable final String text) {
        if(text != null) {
            String trimmed = text.trim();
            if(!trimmed.isEmpty()) {
                return trimmed.replace("\"", "'").replace("\n", " ");
            }
        }
        return null;
    }

    /**
     * Renders the attributes of a single option in this MultiSelect component.
     *
     * @param buffer The buffer to append attributes to.
     * @param choice The choice or option that is being rendered.
     * @param index The index of this choice in the MultiSelect.
     * @param selected The currently selected string value.
     */
    @Override
    @SuppressWarnings("unchecked")
    protected void setOptionAttributes(
            @Nonnull final AppendingStringBuffer buffer,
            @Nonnull final T choice,
            final int index,
            @Nonnull final String selected) {

        super.setOptionAttributes(buffer, choice, index, selected);

        // If there are filter-words for this option, include them into the data-filter attribute
        if(isFilteringAllowed()) {
            // Only include data-filter-text if it will actually be used
            IMultiSelectChoiceRenderer<T> choiceRenderer = (IMultiSelectChoiceRenderer<T>) getChoiceRenderer();
            Set<String> filterWords = choiceRenderer.getFilterWords(choice);
            if (filterWords != null && !filterWords.isEmpty()) {
                String filterText = createFilterText(filterWords);
                if (filterText != null) {
                    buffer.append(" data-filter-text=\"").append(filterText).append("\"");
                }
            }
        }

        // Include the index as a data-index attribute so it can be used for inserting elements at the right position when moving between choices and selection
        buffer.append(" data-index=\"").append(index).append("\"");
    }

    /**
     * Convert a Set of filter words into a single space-separated String of cleaned up lower-case search words.
     *
     * @param filterWords Set of search words for an option that need to be converted into a space-separated list of words.
     * @return Space-separated list of search words for an option or null if the default display-value should be used for filtering.
     */
    @Nullable
    private String createFilterText(@Nonnull final Set<String> filterWords) {
        StringBuilder filterText = new StringBuilder();
        for(String filterWord : filterWords) {
            String cleanFilterWord = cleanUpFilterWord(filterWord);
            if(cleanFilterWord != null) {
                if(filterText.length() > 0) {
                    filterText.append(' ');
                }
                filterText.append(cleanFilterWord);
            }
        }
        return filterText.length() == 0 ? null : filterText.toString();
    }

    /**
     * Cleans up a filter word by trimming the word, converting it to lowercase and escaping double quote's. When the result is an empty String,
     * null will be returned to indicate this word can be left out of the list of search words.
     *
     * @param filterWord The word we want to clean up.
     * @return Cleaned up version of the input filterWord or null if the input was null or the cleaned output is empty.
     */
    @Nullable
    private String cleanUpFilterWord(@Nullable final String filterWord) {
        if(filterWord != null) {
            String cleanFilterWord = filterWord.trim().toLowerCase();
            if(cleanFilterWord.length() > 0) {
                return cleanFilterWord.replace("\"", "\\\"");
            }
        }
        return null;
    }

    /**
     * Responds to every AJAX request coming in.
     *
     * @param event The AJAX request, which may have been triggered by any component.
     */
    @Override
    public void onEvent(@Nonnull final IEvent<?> event) {
        super.onEvent(event);
        Object payload = event.getPayload();
        if(payload instanceof AjaxRequestTarget) {
            // Received AJAX event, make sure the multiselect is reattached in case the markup is rewritten by Wicket
            String markupId = getMarkupId();
            ((AjaxRequestTarget) payload).appendJavaScript("$(\"#" + markupId + "\").multiSelect();");
        }
    }

    /**
     * Returns the list of available choices the user can select from.
     *
     * @return The list of available choices the user can select from.
     */
    @Override
    @SuppressWarnings("unchecked")
    public List<T> getChoices() {
        return (List<T>) super.getChoices();
    }

    /**
     * Returns the list of selected items.
     *
     * @return The list of selected items.
     */
    @Nonnull
    public List<T> getSelection() {
        return (List<T>) getModelObject();
    }

    /**
     * Checks if the buttons for manually ordering items in the selection should be activated.
     *
     * @return True if the buttons for manually ordering items in the selection should be activated.
     */
    public boolean isOrderAllowed() {
        return orderAllowed;
    }

    /**
     * Sets whether the buttons for manually ordering items in the selection should be activated.
     *
     * @param orderAllowed True to activate the buttons for manually ordering items in the selection.
     */
    public void setOrderAllowed(final boolean orderAllowed) {
        this.orderAllowed = orderAllowed;
    }

    /**
     * Checks if the buttons for selecting/deselecting all items at once should be activated.
     *
     * @return True if the buttons for selecting/deselecting all items at once should be activated.
     */
    public boolean isMoveAllAllowed() {
        return moveAllAllowed;
    }

    /**
     * Sets whether the buttons for selecting/deselecting all items at once should be activated.
     *
     * @param moveAllAllowed True to activate the buttons for selecting/deselecting all items at once.
     */
    public void setMoveAllAllowed(final boolean moveAllAllowed) {
        this.moveAllAllowed = moveAllAllowed;
    }

    /**
     * Checks if we should render a vertical palette where the choices-box and the selection-box are aligned vertically instead of horizontally.
     * A vertical layout allows for much longer display-String to be visible, but takes up much vertical space.
     *
     * @return True if we should render the palette vertically instead of the default (horizontal).
     */
    public boolean isVertical() {
        return vertical;
    }

    /**
     * Sets whether we should render a vertical palette where the choices-box and the selection-box are aligned vertically instead of horizontally.
     * A vertical layout allows for much longer display-String to be visible, but takes up much vertical space.
     *
     * @param vertical True to make this component render a vertical lay-out instead of horizontal one.
     */
    public void setVertical(final boolean vertical) {
        this.vertical = vertical;
    }

    /**
     * Checks if we should activate the textfield the user can use for filtering options. When there are many options to choose from, it can help a user
     * if (s)he's able to enter a few search-words to filter the set of visible choices down and find the right option quickly.
     * The search filter takes some extra space though and when there are not many options to choose from, you may want to exclude the filter.
     *
     * @return True if we should activate the search filter for the user.
     */
    public boolean isFilteringAllowed() {
        return filteringAllowed;
    }

    /**
     * Sets whether we should activate the search filter for the user. When there are many options to choose from, it can help a user
     * if (s)he's able to enter a few search-words to filter the set of visible choices down and find the right option quickly.
     * The search filter takes some extra space though and when there are not many options to choose from, you may want to exclude the filter.
     *
     * @param filteringAllowed True to activate the search-filter (default) or false to exclude it.
     */
    public void setFilteringAllowed(final boolean filteringAllowed) {
        this.filteringAllowed = filteringAllowed;
    }

    /**
     * Return a custom CSS class that should be assigned to the palette container. This makes it easier to provide specific styling for a specific situation.
     * If you don't need a custom CSS class, you can simply leave it at the default (null).
     *
     * @return The custom CSS class to add to the class attribute of the container markup or null if you don't need a custom class to be included.
     */
    @Nullable
    protected String getCustomClass() {
        return customClass;
    }

    /**
     * Sets the custom CSS class that should be assigned to the palette container. The default value is null, which means no custom CSS class will be
     * included in the class attribute of the container markup.
     *
     * @param customClass The custom CSS class to include or null.
     */
    public void setCustomClass(@Nullable final String customClass) {
        this.customClass = customClass;
    }
}
