import React, {useMemo} from 'react';
import {NotebookItem} from '../../components/NotebookItem';
import SelectionWrapper from '../../components/SelectionWrapper';
import {useTracked} from '../../provider';
import {ACTIONS} from '../../provider/actions';
import NavigationService from '../../services/NavigationService';

export const NotebookItemWrapper = ({
  item,
  index,
  isTrash = false,
  pinned = false,
}) => {
  const [state, dispatch] = useTracked();
  const {selectionMode, preventDefaultMargins, headerState} = state;
  let params = headerState.route.params || {};

  const style = useMemo(() => {
    return {width: selectionMode ? '90%' : '100%', marginHorizontal: 0};
  }, [selectionMode]);

  const onLongPress = () => {
    if (!selectionMode) {
      dispatch({
        type: ACTIONS.SELECTION_MODE,
        enabled: !selectionMode,
      });
    }

    dispatch({
      type: ACTIONS.SELECTED_ITEMS,
      item: item,
    });
  };

  const onPress = () => {
    if (selectionMode) {
      onLongPress();
      return;
    }
    dispatch({
      type: ACTIONS.HEADER_TEXT_STATE,
      state: {
        heading: item.title,
      },
    });
    dispatch({
      type: ACTIONS.HEADER_STATE,
      state: {
        canGoBack: true,
        menu: false,
      },
    });
    dispatch({
      type: ACTIONS.CONTAINER_BOTTOM_BUTTON,
      state: {
        bottomButtonText: 'Add new topic',
      },
    });

    NavigationService.navigate('Notebook', {
      notebook: item,
      title: item.title,
      root: true,
    });
  };

  return (
    <SelectionWrapper
      onLongPress={onLongPress}
      pinned={pinned}
      index={index}
      onPress={onPress}
      item={item}>
      <NotebookItem
        hideMore={preventDefaultMargins}
        isTopic={item.type === 'topic'}
        customStyle={style}
        noteToMove={params.note}
        item={item}
        index={index}
        isTrash={isTrash}
      />
    </SelectionWrapper>
  );
};
