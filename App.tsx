import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sound from 'react-native-sound';

Sound.setCategory('Playback');

const SCORES_KEY = 'tap_fast_scores';
const MAX_SCORES = 5;

type GameState = 'idle' | 'waiting' | 'ready' | 'early' | 'result';

const BG: Record<GameState, string> = {
  idle: '#1a1a2e',
  waiting: '#1a1a2e',
  ready: '#00c853',
  early: '#b71c1c',
  result: '#0d47a1',
};

const formatMs = (ms: number) => `${ms} ms`;

const loadSound = (file: string): Sound =>
  new Sound(
    Platform.OS === 'android' ? file : `sounds/${file}`,
    Platform.OS === 'android' ? Sound.MAIN_BUNDLE : Sound.MAIN_BUNDLE,
    (err: Error | null) => {
      if (err) console.log('Sound load error', file, err);
    },
  );

const playSound = (sound: Sound | null) => {
  if (!sound) return;
  sound.stop(() => sound.play());
};

export default function App() {
  const [state, setState] = useState<GameState>('idle');
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const startTime = useRef<number>(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const sndGo = useRef<Sound | null>(null);
  const sndTap = useRef<Sound | null>(null);
  const sndEarly = useRef<Sound | null>(null);
  const sndBest = useRef<Sound | null>(null);

  useEffect(() => {
    loadScores();
    sndGo.current = loadSound('go.wav');
    sndTap.current = loadSound('tap.wav');
    sndEarly.current = loadSound('early.wav');
    sndBest.current = loadSound('best.wav');

    return () => {
      if (timer.current) clearTimeout(timer.current);
      [sndGo, sndTap, sndEarly, sndBest].forEach(r => r.current?.release());
    };
  }, []);

  const loadScores = async () => {
    try {
      const raw = await AsyncStorage.getItem(SCORES_KEY);
      if (raw) setScores(JSON.parse(raw));
    } catch {}
  };

  const saveScore = useCallback(
    async (ms: number): Promise<boolean> => {
      const updated = [...scores, ms].sort((a, b) => a - b).slice(0, MAX_SCORES);
      const isNewBest = updated[0] === ms && (scores.length === 0 || ms < scores[0]);
      setScores(updated);
      try {
        await AsyncStorage.setItem(SCORES_KEY, JSON.stringify(updated));
      } catch {}
      return isNewBest;
    },
    [scores],
  );

  const handlePress = useCallback(() => {
    if (state === 'waiting') {
      if (timer.current) clearTimeout(timer.current);
      playSound(sndEarly.current);
      setState('early');
      return;
    }

    if (state === 'ready') {
      const ms = Date.now() - startTime.current;
      setReactionTime(ms);
      saveScore(ms).then(isNewBest => {
        if (isNewBest) {
          playSound(sndBest.current);
        } else {
          playSound(sndTap.current);
        }
      });
      setState('result');
      Animated.sequence([
        Animated.timing(scaleAnim, {toValue: 0.92, duration: 80, useNativeDriver: true}),
        Animated.spring(scaleAnim, {toValue: 1, useNativeDriver: true}),
      ]).start();
      return;
    }

    if (state === 'idle' || state === 'result' || state === 'early') {
      setState('waiting');
      setReactionTime(null);
      const delay = 1500 + Math.random() * 2500;
      timer.current = setTimeout(() => {
        startTime.current = Date.now();
        setState('ready');
        playSound(sndGo.current);
      }, delay);
    }
  }, [state, saveScore, scaleAnim]);

  const bgColor = BG[state];

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={bgColor} />
      <TouchableWithoutFeedback onPress={handlePress}>
        <Animated.View
          style={[styles.container, {backgroundColor: bgColor, transform: [{scale: scaleAnim}]}]}>
          <SafeAreaView style={styles.inner}>
            {state === 'idle' && (
              <View style={styles.content}>
                <Text style={styles.title}>TAP FAST</Text>
                <Text style={styles.subtitle}>Reaction Time Tester</Text>
                <View style={styles.circle}>
                  <Text style={styles.circleText}>TAP{'\n'}TO{'\n'}START</Text>
                </View>
                {scores.length > 0 && (
                  <View style={styles.scoresBox}>
                    <Text style={styles.scoresTitle}>BEST SCORES</Text>
                    {scores.map((s, i) => (
                      <Text key={i} style={styles.scoreRow}>
                        #{i + 1}  {formatMs(s)}{i === 0 ? '  🏆' : ''}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {state === 'waiting' && (
              <View style={styles.content}>
                <Text style={styles.label}>GET READY…</Text>
                <View style={[styles.circle, styles.circleDim]}>
                  <Text style={styles.circleText}>{'●'}</Text>
                </View>
                <Text style={styles.hint}>Don't tap yet!</Text>
              </View>
            )}

            {state === 'ready' && (
              <View style={styles.content}>
                <Text style={styles.label}>TAP NOW!</Text>
                <View style={[styles.circle, styles.circleGreen]}>
                  <Text style={styles.circleText}>GO!</Text>
                </View>
              </View>
            )}

            {state === 'early' && (
              <View style={styles.content}>
                <Text style={[styles.label, {color: '#ff5252'}]}>TOO EARLY!</Text>
                <View style={[styles.circle, styles.circleRed]}>
                  <Text style={styles.circleText}>✗</Text>
                </View>
                <Text style={styles.hint}>Tap to try again</Text>
              </View>
            )}

            {state === 'result' && (
              <View style={styles.content}>
                <Text style={styles.label}>YOUR TIME</Text>
                <View style={[styles.circle, styles.circleBlue]}>
                  <Text style={styles.resultTime}>
                    {reactionTime != null ? formatMs(reactionTime) : '—'}
                  </Text>
                </View>
                {reactionTime != null && scores[0] === reactionTime && (
                  <Text style={styles.newBest}>🏆 NEW BEST!</Text>
                )}
                <Text style={styles.hint}>Tap to play again</Text>
              </View>
            )}
          </SafeAreaView>
        </Animated.View>
      </TouchableWithoutFeedback>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  inner: {flex: 1},
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 44,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 3,
    marginTop: 6,
    marginBottom: 48,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 5,
    textTransform: 'uppercase',
  },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 36,
  },
  circleDim: {
    borderColor: 'rgba(255,255,255,0.15)',
  },
  circleGreen: {
    backgroundColor: '#00e676',
    borderColor: '#69f0ae',
    shadowColor: '#00e676',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 24,
    elevation: 16,
  },
  circleRed: {
    backgroundColor: '#c62828',
    borderColor: '#ff5252',
  },
  circleBlue: {
    backgroundColor: '#1565c0',
    borderColor: '#82b1ff',
  },
  circleText: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: 2,
  },
  resultTime: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
  hint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2,
    marginTop: 8,
  },
  newBest: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffd740',
    letterSpacing: 2,
    marginTop: 4,
  },
  scoresBox: {
    marginTop: 12,
    alignItems: 'center',
  },
  scoresTitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 4,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  scoreRow: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1,
    marginBottom: 6,
    fontWeight: '600',
  },
});
