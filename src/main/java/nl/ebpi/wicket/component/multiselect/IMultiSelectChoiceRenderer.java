package nl.ebpi.wicket.component.multiselect;

import java.util.Set;
import javax.annotation.Nonnull;
import javax.annotation.Nullable;
import org.apache.wicket.markup.html.form.IChoiceRenderer;

/**
 * ChoiceRenderer for het MultiSelect component.
 *
 * @param <T>  The type of element this IMultiSelectChoiceRenderer works with.
 * @author Onno Scheffers
 */
public interface IMultiSelectChoiceRenderer<T> extends IChoiceRenderer<T> {
    /**
     * Creates a Set of words that can be used for filtering options. If this method returns null or an empty Set,
     * the {@link #getDisplayValue} of the choice will be used for filtering.
     *
     * @param object The actual choice object to create the filter words for.
     * @return the value meant for displaying to an end user
     */
    @Nullable
    Set<String> getFilterWords(@Nonnull final T object);
}
