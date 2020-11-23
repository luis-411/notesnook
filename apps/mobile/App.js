import * as NetInfo from '@react-native-community/netinfo';
import {EV} from 'notes-core/common';
import React, {useEffect, useState} from 'react';
import {Appearance, AppState, Platform, StatusBar} from 'react-native';
import {enabled} from 'react-native-privacy-snapshot';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {useTracked} from './src/provider';
import {Actions} from './src/provider/Actions';
import {
  eSubscribeEvent,
  eUnSubscribeEvent,
  ToastEvent,
} from './src/services/EventManager';
import {setLoginMessage} from './src/services/Message';
import {editing} from './src/utils';
import {COLOR_SCHEME} from './src/utils/Colors';
import {db} from './src/utils/DB';
import {eDispatchAction, eStartSyncer} from './src/utils/Events';
import {MMKV} from './src/utils/mmkv';
import {sleep} from './src/utils/TimeUtils';
import {getNote} from './src/views/Editor/Functions';

let AppRootView = require('./initializer.intent').IntentView;
let SettingsService = null;
let Sentry = null;
let appInit = false;

const onAppStateChanged = async (state) => {
  console.log('app state', state);
  if (state === 'active') {
    StatusBar.setBarStyle(
      COLOR_SCHEME.night ? 'light-content' : 'dark-content',
      true,
    );
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('transparent', true);
      StatusBar.setTranslucent(true, true);
    }
    if (SettingsService.get().privacyScreen) {
      enabled(false);
    }
    console.log('clearing state', await MMKV.getItem('appState'));
    if (appInit) {
      await MMKV.removeItem('appState');
    }
  } else {
    if (editing.currentlyEditing && appInit) {
      let state = JSON.stringify({
        editing: editing.currentlyEditing,
        note: getNote(),
      });
      console.log('putting items in state', state);
      await MMKV.setItem('appState', state);
    }

    if (SettingsService.get().privacyScreen) {
      enabled(true);
    }
  }
};

const onNetworkStateChanged = (netInfo) => {
  let message = 'Internet connection restored';
  let type = 'success';
  if (!netInfo.isConnected || !netInfo.isInternetReachable) {
    message = 'No internet connection';
    type = 'error';
  }
  db.user?.get().then((user) => {
    if (user) {
      ToastEvent.show(message, type);
    }
  });
};

const App = () => {
  const [, dispatch] = useTracked(),
    [init, setInit] = useState(false),
    [intent, setIntent] = useState(false);

  const syncChanges = async () => {
    dispatch({type: Actions.ALL});
  };
  const startSyncer = async () => {
    try {
      let user = await db.user.get();
      if (user) {
        EV.subscribe('db:refresh', syncChanges);
      }
    } catch (e) {
      console.log(e);
    }
  };

  const onSystemThemeChanged = async () => {
    await SettingsService.setTheme();
  };

  useEffect(() => {
    eSubscribeEvent(eStartSyncer, startSyncer);
    eSubscribeEvent(eDispatchAction, (type) => {
      dispatch(type);
    });
    AppState.addEventListener('change', onAppStateChanged);
    eSubscribeEvent('nointent', loadMainApp);
    Appearance.addChangeListener(onSystemThemeChanged);
    let unsub = NetInfo.addEventListener(onNetworkStateChanged);
    return () => {
      EV.unsubscribe('db:refresh', syncChanges);
      eUnSubscribeEvent(eStartSyncer, startSyncer);
      eUnSubscribeEvent(eDispatchAction, (type) => {
        dispatch(type);
      });
      eUnSubscribeEvent('nointent', loadMainApp);
      AppState.removeEventListener('change', onAppStateChanged);
      Appearance.removeChangeListener(onSystemThemeChanged);
      unsub();
    };
  }, []);

  const loadMainApp = () => {
    setIntent(false);
    AppRootView = require('./initializer.root').RootView;
    setInit(true);
    backupData().then((r) => r);
    sleep(300).then(() => (appInit = true));
    //Sentry = require('@sentry/react-native');
   // Sentry.init({
   //   dsn:
   //     'https://317a5c31caf64d1e9b27abf15eb1a554@o477952.ingest.sentry.io/5519681',
   // });
  };

  const getUser = async () => {
    try {
      let user = await db.user.get();
      if (user) {
        dispatch({type: Actions.USER, user: user});
        dispatch({type: Actions.SYNCING, syncing: true});
        await db.sync();
        dispatch({type: Actions.SYNCING, syncing: false});
        dispatch({type: Actions.ALL});
        await startSyncer();
      } else {
        setLoginMessage(dispatch);
      }
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    SettingsService = require('./src/services/SettingsService').default;
    SettingsService.init();
    db.init().finally(runAfterInit);
  }, []);

  const runAfterInit = () => {
    setIntent(true);
    dispatch({type: Actions.ALL});
    getUser().catch((e) => e);
  };

  async function backupData() {
    let settings = SettingsService.get();
    let Backup = require('./src/services/Backup').default;
    if (await Backup.checkBackupRequired(settings.reminder)) {
      try {
        await Backup.run();
      } catch (e) {
        console.log(e);
      }
    }
  }

  return (
    <SafeAreaProvider>
      {intent ? <AppRootView /> : null}
      {init && !intent ? <AppRootView /> : null}
    </SafeAreaProvider>
  );
};

export default App;
