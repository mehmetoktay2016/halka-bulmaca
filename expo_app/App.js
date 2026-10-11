// Expo Go ile test için: oyunun tek dosyalık sürümünü (game-html.js) tam ekran WebView'da gösterir.
// game-html.js'i güncellemek için ana klasörde: node tools/build_single.js
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import gameHtml from './game-html';

const BG = '#0b0e1c';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <WebView
          style={styles.web}
          originWhitelist={['*']}
          // baseUrl: sayfaya sabit bir köken verir; ilerleme kaydı (localStorage) böylece çalışır
          source={{ html: gameHtml, baseUrl: 'https://localhost/' }}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          overScrollMode="never"
          bounces={false}
          setSupportMultipleWindows={false}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  web: { flex: 1, backgroundColor: BG },
});
