import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts,
} from "@expo-google-fonts/dm-sans";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_BUDGET = 8000;
const CATEGORIES = [
  { name: "Food", icon: "🍔", color: "#FF6B6B", bg: "#FF6B6B22" },
  { name: "Transport", icon: "🚗", color: "#4ECDC4", bg: "#4ECDC422" },
  { name: "Shopping", icon: "🛍️", color: "#A78BFA", bg: "#A78BFA22" },
  { name: "Bills", icon: "💡", color: "#F59E0B", bg: "#F59E0B22" },
  { name: "Health", icon: "🏥", color: "#34D399", bg: "#34D39922" },
  { name: "Leisure", icon: "🎮", color: "#60A5FA", bg: "#60A5FA22" },
  { name: "Education", icon: "📚", color: "#F472B6", bg: "#F472B622" },
  { name: "Other", icon: "📦", color: "#94A3B8", bg: "#94A3B822" },
];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatPHP = (amt) =>
  `₱${Number(amt).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const todayStr = () => new Date().toISOString().split("T")[0];

const getCatMeta = (name) =>
  CATEGORIES.find((c) => c.name === name) || CATEGORIES[CATEGORIES.length - 1];

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  bg: "#0A0F1E",
  surface: "#111827",
  card: "#1A2235",
  border: "#1E293B",
  accent: "#6366F1",
  accentLt: "#818CF8",
  success: "#10B981",
  danger: "#EF4444",
  text: "#F1F5F9",
  subtext: "#94A3B8",
  muted: "#475569",
};

// ─── Animated Helpers ─────────────────────────────────────────────────────────
function useSpring(toValue, config = {}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
      ...config,
    }).start();
  }, [toValue]);
  return anim;
}

function useFadeIn(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        delay,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        delay,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

// ─── Pressable with scale feedback ────────────────────────────────────────────
function PressScale({ children, onPress, style, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  return (
    <TouchableWithoutFeedback
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, visible }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 12,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        { opacity, transform: [{ translateY }] },
        type === "error" && { backgroundColor: T.danger },
        type === "success" && { backgroundColor: T.success },
      ]}
    >
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

function useToast() {
  const [toast, setToast] = useState({
    message: "",
    type: "success",
    visible: false,
  });
  const show = (message, type = "success") => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500);
  };
  return { toast, show };
}

// ─── Animated Number ──────────────────────────────────────────────────────────
function AnimatedNumber({ value, style, prefix = "" }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const id = anim.addListener(({ value: v }) => setDisplay(v));
    return () => anim.removeListener(id);
  }, [value]);
  return (
    <Text style={style}>
      {prefix}₱
      {Number(display).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
    </Text>
  );
}

// ─── Animated Progress Bar ────────────────────────────────────────────────────
function AnimBar({ pct, color, height = 6, delay = 0 }) {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, {
      toValue: pct,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);
  return (
    <View style={[styles.barBg, { height }]}>
      <Animated.View
        style={[
          styles.barFill,
          {
            height,
            backgroundColor: color || T.accent,
            width: width.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}

// ─── Swipeable Row ────────────────────────────────────────────────────────────
function SwipeableRow({ children, onDelete }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 5 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, -90));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -60) {
          Animated.spring(translateX, {
            toValue: -80,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    }),
  ).current;
  return (
    <View style={{ overflow: "hidden", borderRadius: 18, marginBottom: 10 }}>
      <View style={styles.deleteUnderlay}>
        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnIcon}>🗑</Text>
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ byCategory, total }) {
  const size = 170;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  const animProgress = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    Animated.timing(animProgress, {
      toValue: 1,
      duration: 1200,
      delay: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const id = animProgress.addListener(({ value: v }) => setProgress(v));
    return () => animProgress.removeListener(id);
  }, [byCategory]);

  if (!byCategory.length) return null;

  let offset = 0;
  const segments = byCategory.map(([cat, amt]) => {
    const meta = getCatMeta(cat);
    const pct = amt / total;
    const seg = { cat, amt, meta, pct, offset };
    offset += pct;
    return seg;
  });

  return (
    <View style={{ alignItems: "center", marginBottom: 20 }}>
      <View style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: "absolute" }}
        >
          {/* background ring */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={T.border}
            strokeWidth={stroke}
          />
          {segments.map((seg) => (
            <circle
              key={seg.cat}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.meta.color}
              strokeWidth={stroke}
              strokeDasharray={`${seg.pct * circ * progress} ${circ}`}
              strokeDashoffset={-seg.offset * circ * progress}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          ))}
        </svg>
        <View style={styles.donutCenter}>
          <Text style={styles.donutTotal}>{formatPHP(total)}</Text>
          <Text style={styles.donutLabel}>spent</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Budget Modal ─────────────────────────────────────────────────────────────
function BudgetModal({ visible, current, onSave, onClose }) {
  const [val, setVal] = useState(String(current));
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      setVal(String(current));
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.85,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);
  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[styles.modalCard, { opacity, transform: [{ scale }] }]}
            >
              <Text style={styles.modalTitle}>Set Monthly Budget</Text>
              <TextInput
                style={styles.modalInput}
                value={val}
                onChangeText={setVal}
                keyboardType="numeric"
                placeholder="e.g. 12000"
                placeholderTextColor={T.muted}
                autoFocus
              />
              <PressScale
                onPress={() => {
                  const n = parseFloat(val);
                  if (!n || n <= 0) return;
                  onSave(n);
                  onClose();
                }}
                style={styles.modalSaveBtn}
              >
                <Text style={styles.modalSaveBtnText}>Save Budget</Text>
              </PressScale>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Screen Wrapper with fade ─────────────────────────────────────────────────
function ScreenFade({ children }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  return <Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("home");
  const [expenses, setExpenses] = useState([]);
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const { toast, show: showToast } = useToast();
  const prevScreen = useRef("home");

  let [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  // Persistence
  useEffect(() => {
    (async () => {
      try {
        const [savedExp, savedBudget] = await Promise.all([
          AsyncStorage.getItem("expenses_v2"),
          AsyncStorage.getItem("budget"),
        ]);
        if (savedExp) setExpenses(JSON.parse(savedExp));
        if (savedBudget) setBudget(parseFloat(savedBudget));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("expenses_v2", JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    AsyncStorage.setItem("budget", String(budget));
  }, [budget]);

  if (!fontsLoaded) return null;

  const addExpense = (item) => {
    setExpenses([{ ...item, id: Date.now(), date: todayStr() }, ...expenses]);
    showToast("Expense added!", "success");
  };

  const deleteExpense = (id) => {
    setExpenses(expenses.filter((e) => e.id !== id));
    showToast("Expense deleted", "error");
  };

  const navigateTo = (s) => {
    prevScreen.current = screen;
    setScreen(s);
  };

  const TABS = [
    { id: "home", icon: "🏠", label: "Home" },
    { id: "history", icon: "📋", label: "History" },
    { id: "add", icon: "➕", label: "Add" },
    { id: "stats", icon: "📊", label: "Stats" },
    { id: "profile", icon: "👤", label: "Profile" },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <Toast {...toast} />

      {/* SCREENS */}
      <View style={{ flex: 1 }}>
        {screen === "home" && (
          <ScreenFade key="home">
            <HomeScreen
              expenses={expenses}
              budget={budget}
              setScreen={navigateTo}
              onEditBudget={() => setShowBudgetModal(true)}
            />
          </ScreenFade>
        )}
        {screen === "add" && (
          <ScreenFade key="add">
            <AddScreen onAdd={addExpense} setScreen={navigateTo} />
          </ScreenFade>
        )}
        {screen === "history" && (
          <ScreenFade key="history">
            <HistoryScreen expenses={expenses} onDelete={deleteExpense} />
          </ScreenFade>
        )}
        {screen === "stats" && (
          <ScreenFade key="stats">
            <StatsScreen expenses={expenses} budget={budget} />
          </ScreenFade>
        )}
        {screen === "profile" && (
          <ScreenFade key="profile">
            <ProfileScreen
              budget={budget}
              expenses={expenses}
              onEditBudget={() => setShowBudgetModal(true)}
              onClearAll={() => {
                Alert.alert("Clear All", "Delete all expense history?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Clear",
                    style: "destructive",
                    onPress: () => {
                      setExpenses([]);
                      showToast("History cleared", "error");
                    },
                  },
                ]);
              }}
            />
          </ScreenFade>
        )}
      </View>

      {/* TAB BAR */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            active={screen === tab.id}
            onPress={() => navigateTo(tab.id)}
          />
        ))}
      </View>

      <BudgetModal
        visible={showBudgetModal}
        current={budget}
        onSave={setBudget}
        onClose={() => setShowBudgetModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Tab Item ─────────────────────────────────────────────────────────────────
function TabItem({ tab, active, onPress }) {
  const scale = useRef(new Animated.Value(active ? 1 : 0.85)).current;
  const opacity = useRef(new Animated.Value(active ? 1 : 0.45)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: active ? 1 : 0.85,
        useNativeDriver: true,
        tension: 200,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: active ? 1 : 0.45,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [active]);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.tabItem}
      activeOpacity={0.7}
    >
      <Animated.View
        style={{ alignItems: "center", transform: [{ scale }], opacity }}
      >
        {tab.id === "add" ? (
          <View style={styles.addTabBtn}>
            <Text style={{ fontSize: 22 }}>➕</Text>
          </View>
        ) : (
          <>
            <Text style={{ fontSize: 22 }}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, active && { color: T.accentLt }]}>
              {tab.label}
            </Text>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function HomeScreen({ expenses, budget, setScreen, onEditBudget }) {
  const total = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses],
  );
  const remaining = budget - total;
  const pct = Math.min(total / budget, 1);
  const today = new Date().toISOString().split("T")[0];
  const todayExpenses = expenses.filter((e) => e.date === today);
  const todayTotal = todayExpenses.reduce((s, e) => s + e.amount, 0);
  const now = new Date();
  const monthName = MONTHS[now.getMonth()] + " " + now.getFullYear();
  const recent = expenses.slice(0, 5);

  const anim0 = useFadeIn(0);
  const anim1 = useFadeIn(80);
  const anim2 = useFadeIn(160);
  const anim3 = useFadeIn(240);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 30 }}
    >
      {/* Header */}
      <Animated.View style={[styles.homeHeader, anim0]}>
        <View>
          <Text style={styles.homeGreeting}>Good {getGreeting()} 👋</Text>
          <Text style={styles.homeSubGreeting}>{monthName} Overview</Text>
        </View>
        <PressScale onPress={onEditBudget} style={styles.budgetEditBtn}>
          <Text style={{ fontSize: 18 }}>⚙️</Text>
        </PressScale>
      </Animated.View>

      {/* Budget Card */}
      <Animated.View style={anim1}>
        <View style={styles.budgetCard}>
          <View style={styles.budgetCardRow}>
            <View>
              <Text style={styles.budgetCardLabel}>Remaining Budget</Text>
              <AnimatedNumber
                value={Math.max(remaining, 0)}
                style={[
                  styles.budgetCardAmount,
                  remaining < 0 && { color: T.danger },
                ]}
              />
            </View>
            <View style={styles.budgetCircle}>
              <Text style={styles.budgetCirclePct}>
                {Math.round(pct * 100)}%
              </Text>
              <Text style={styles.budgetCircleLabel}>used</Text>
            </View>
          </View>
          <AnimBar
            pct={pct}
            color={pct > 0.8 ? T.danger : pct > 0.6 ? "#F59E0B" : T.success}
            height={8}
          />
          <View style={styles.budgetCardFooter}>
            <Text style={styles.budgetCardSub}>
              Budget: {formatPHP(budget)}
            </Text>
            <Text style={styles.budgetCardSub}>Spent: {formatPHP(total)}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Quick Stats Row */}
      <Animated.View style={[styles.quickStatsRow, anim2]}>
        <View style={styles.quickStatCard}>
          <Text style={styles.quickStatIcon}>📅</Text>
          <Text style={styles.quickStatVal}>{formatPHP(todayTotal)}</Text>
          <Text style={styles.quickStatLabel}>Today</Text>
        </View>
        <View style={styles.quickStatCard}>
          <Text style={styles.quickStatIcon}>🧾</Text>
          <Text style={styles.quickStatVal}>{expenses.length}</Text>
          <Text style={styles.quickStatLabel}>Transactions</Text>
        </View>
        <View style={styles.quickStatCard}>
          <Text style={styles.quickStatIcon}>📈</Text>
          <Text style={styles.quickStatVal}>
            {expenses.length ? formatPHP(total / expenses.length) : "₱0.00"}
          </Text>
          <Text style={styles.quickStatLabel}>Avg / Entry</Text>
        </View>
      </Animated.View>

      {/* Categories */}
      <Animated.View style={anim3}>
        <SectionHeader title="Categories" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ paddingLeft: 20, marginBottom: 20 }}
        >
          {CATEGORIES.map((c) => {
            const catTotal = expenses
              .filter((e) => e.category === c.name)
              .reduce((s, e) => s + e.amount, 0);
            return (
              <View
                key={c.name}
                style={[styles.catChip, { borderColor: c.color + "55" }]}
              >
                <View
                  style={[
                    styles.catChipIcon,
                    { backgroundColor: c.color + "22" },
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>{c.icon}</Text>
                </View>
                <Text style={styles.catChipName}>{c.name}</Text>
                <Text style={[styles.catChipAmt, { color: c.color }]}>
                  {catTotal > 0 ? formatPHP(catTotal) : "—"}
                </Text>
              </View>
            );
          })}
          <View style={{ width: 20 }} />
        </ScrollView>

        {/* Recent */}
        <View style={styles.recentRow}>
          <SectionHeader title="Recent" inline />
          <TouchableOpacity onPress={() => setScreen("history")}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          {recent.length === 0 ? (
            <EmptyState message="No expenses yet. Tap ➕ to add one." />
          ) : (
            recent.map((e, i) => (
              <ExpenseRow key={e.id} expense={e} delay={i * 60} />
            ))
          )}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function AddScreen({ onAdd, setScreen }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");

  const titleAnim = useFadeIn(0);
  const amountAnim = useFadeIn(60);
  const catAnim = useFadeIn(120);
  const noteAnim = useFadeIn(180);
  const btnAnim = useFadeIn(240);

  const selectedCat = getCatMeta(category);

  const handleSave = () => {
    if (!title.trim()) return Alert.alert("Missing", "Please enter a title.");
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0)
      return Alert.alert("Invalid", "Enter a valid amount.");
    onAdd({ title: title.trim(), amount: n, category, note: note.trim() });
    setScreen("home");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>Add Expense</Text>

        <Animated.View style={titleAnim}>
          <FieldLabel label="Title" />
          <TextInput
            placeholder="What did you buy?"
            placeholderTextColor={T.muted}
            style={styles.input}
            value={title}
            onChangeText={setTitle}
          />
        </Animated.View>

        <Animated.View style={amountAnim}>
          <FieldLabel label="Amount (₱)" />
          <TextInput
            placeholder="0.00"
            placeholderTextColor={T.muted}
            style={[styles.input, styles.amountInput]}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
        </Animated.View>

        <Animated.View style={catAnim}>
          <FieldLabel label="Category" />
          <View style={styles.catSelectGrid}>
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.name;
              return (
                <PressScale
                  key={cat.name}
                  onPress={() => setCategory(cat.name)}
                  style={[
                    styles.catSelectBtn,
                    isActive && {
                      borderColor: cat.color,
                      backgroundColor: cat.color + "18",
                    },
                  ]}
                >
                  <Text style={{ fontSize: 26 }}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.catSelectText,
                      isActive && { color: cat.color },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </PressScale>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View style={noteAnim}>
          <FieldLabel label="Note (optional)" />
          <TextInput
            placeholder="Any extra details..."
            placeholderTextColor={T.muted}
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            multiline
            value={note}
            onChangeText={setNote}
          />
        </Animated.View>

        <Animated.View style={btnAnim}>
          <PressScale
            onPress={handleSave}
            style={[styles.saveBtn, { backgroundColor: selectedCat.color }]}
          >
            <Text style={styles.saveBtnText}>
              {selectedCat.icon} Save Expense
            </Text>
          </PressScale>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function HistoryScreen({ expenses, onDelete }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const matchSearch = e.title.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCat === "All" || e.category === filterCat;
      return matchSearch && matchCat;
    });
  }, [expenses, search, filterCat]);

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <View style={{ flex: 1, paddingTop: 10 }}>
      {/* Fixed Header */}
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={styles.screenTitle}>Transactions</Text>
        <View style={styles.searchBar}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            placeholder="Search expenses..."
            placeholderTextColor={T.muted}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={{ color: T.muted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
        >
          {["All", ...CATEGORIES.map((c) => c.name)].map((cat) => {
            const meta = cat !== "All" ? getCatMeta(cat) : null;
            const active = filterCat === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setFilterCat(cat)}
                style={[
                  styles.filterChip,
                  active && {
                    backgroundColor: meta ? meta.color : T.accent,
                    borderColor: "transparent",
                  },
                ]}
              >
                {meta && (
                  <Text style={{ fontSize: 13, marginRight: 4 }}>
                    {meta.icon}
                  </Text>
                )}
                <Text
                  style={[styles.filterChipText, active && { color: "white" }]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
          <View style={{ width: 16 }} />
        </ScrollView>
        {filtered.length > 0 && (
          <Text style={styles.resultSummary}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} ·{" "}
            {formatPHP(totalFiltered)}
          </Text>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState message="No expenses match your search." />
        }
        renderItem={({ item, index }) => (
          <SwipeableRow onDelete={() => onDelete(item.id)}>
            <ExpenseRow
              expense={item}
              onDelete={onDelete}
              showDate
              delay={index * 40}
            />
          </SwipeableRow>
        )}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function StatsScreen({ expenses, budget }) {
  const total = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses],
  );
  const byCategory = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  // Daily trend (last 7 days)
  const dailyData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const sum = expenses
        .filter((e) => e.date === key)
        .reduce((s, e) => s + e.amount, 0);
      days.push({
        label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()],
        sum,
        key,
      });
    }
    return days;
  }, [expenses]);

  const maxDay = Math.max(...dailyData.map((d) => d.sum), 1);
  const anim0 = useFadeIn(0);
  const anim1 = useFadeIn(100);
  const anim2 = useFadeIn(200);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      <Text style={styles.screenTitle}>Statistics</Text>

      {/* Donut */}
      <Animated.View style={[styles.statsCard, anim0]}>
        <DonutChart byCategory={byCategory} total={total} />
        <View style={styles.legendRow}>
          {byCategory.slice(0, 4).map(([cat, amt]) => {
            const meta = getCatMeta(cat);
            return (
              <View key={cat} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: meta.color }]}
                />
                <Text style={styles.legendText}>{cat}</Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {/* Budget Overview */}
      <Animated.View style={[styles.statsCard, anim1]}>
        <Text style={styles.statsCardTitle}>Budget Overview</Text>
        <View style={styles.statsRow}>
          <StatTile
            label="Budget"
            value={formatPHP(budget)}
            color={T.accentLt}
            icon="🎯"
          />
          <StatTile
            label="Spent"
            value={formatPHP(total)}
            color={T.danger}
            icon="💸"
          />
          <StatTile
            label="Left"
            value={formatPHP(Math.max(budget - total, 0))}
            color={T.success}
            icon="✅"
          />
        </View>
        <AnimBar
          pct={Math.min(total / budget, 1)}
          color={total > budget ? T.danger : T.accent}
          height={10}
        />
        <Text style={[styles.statsNote, { marginTop: 8 }]}>
          {total > budget
            ? `⚠️ Over budget by ${formatPHP(total - budget)}`
            : `✅ ${Math.round((1 - total / budget) * 100)}% of budget remaining`}
        </Text>
      </Animated.View>

      {/* 7-Day Trend */}
      <Animated.View style={[styles.statsCard, anim2]}>
        <Text style={styles.statsCardTitle}>Last 7 Days</Text>
        <View style={styles.barChart}>
          {dailyData.map((d, i) => {
            const h = (d.sum / maxDay) * 80;
            return (
              <View key={d.key} style={styles.barChartCol}>
                <Text style={styles.barChartVal}>
                  {d.sum > 0 ? `₱${Math.round(d.sum)}` : ""}
                </Text>
                <AnimBar
                  pct={d.sum / maxDay}
                  color={T.accent}
                  height={80}
                  delay={i * 60}
                />
                <Text style={styles.barChartLabel}>{d.label}</Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {/* By Category */}
      <Text style={[styles.sectionHeaderInline, { marginBottom: 12 }]}>
        By Category
      </Text>
      {byCategory.length === 0 && <EmptyState message="No data yet." />}
      {byCategory.map(([cat, amt], i) => {
        const meta = getCatMeta(cat);
        const pct = total > 0 ? amt / total : 0;
        return (
          <Animated.View
            key={cat}
            style={[styles.catStatRow, useFadeIn(i * 60)]}
          >
            <View style={styles.catStatHeader}>
              <View
                style={[styles.iconBox, { backgroundColor: meta.color + "22" }]}
              >
                <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
              </View>
              <Text style={styles.catStatName}>{cat}</Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.catStatAmt, { color: meta.color }]}>
                  {formatPHP(amt)}
                </Text>
                <Text style={styles.catStatPct}>{Math.round(pct * 100)}%</Text>
              </View>
            </View>
            <AnimBar pct={pct} color={meta.color} height={6} delay={i * 80} />
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function ProfileScreen({ budget, expenses, onEditBudget, onClearAll }) {
  const total = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses],
  );
  const anim = useFadeIn(0);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.screenTitle}>Profile</Text>
      <Animated.View style={anim}>
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={{ fontSize: 36 }}>💰</Text>
          </View>
          <Text style={styles.profileName}>My Wallet</Text>
          <Text style={styles.profileSub}>
            {expenses.length} transactions recorded
          </Text>
        </View>

        <Text style={styles.sectionHeaderInline}>Budget Settings</Text>
        <PressScale onPress={onEditBudget} style={styles.settingRow}>
          <Text style={{ fontSize: 20, marginRight: 12 }}>🎯</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Monthly Budget</Text>
            <Text style={styles.settingValue}>{formatPHP(budget)}</Text>
          </View>
          <Text style={{ color: T.subtext }}>Edit →</Text>
        </PressScale>

        <Text style={[styles.sectionHeaderInline, { marginTop: 24 }]}>
          Stats Summary
        </Text>
        <View style={styles.settingRow}>
          <Text style={{ fontSize: 20, marginRight: 12 }}>💸</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Total Spent This Month</Text>
            <Text style={[styles.settingValue, { color: T.danger }]}>
              {formatPHP(total)}
            </Text>
          </View>
        </View>
        <View style={styles.settingRow}>
          <Text style={{ fontSize: 20, marginRight: 12 }}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Remaining Budget</Text>
            <Text style={[styles.settingValue, { color: T.success }]}>
              {formatPHP(Math.max(budget - total, 0))}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionHeaderInline, { marginTop: 24 }]}>
          Danger Zone
        </Text>
        <PressScale
          onPress={onClearAll}
          style={[styles.settingRow, { borderColor: T.danger + "44" }]}
        >
          <Text style={{ fontSize: 20, marginRight: 12 }}>🗑️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: T.danger }]}>
              Clear All History
            </Text>
            <Text style={styles.settingValue}>This cannot be undone</Text>
          </View>
        </PressScale>
      </Animated.View>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function ExpenseRow({ expense, onDelete, showDate, delay = 0 }) {
  const meta = getCatMeta(expense.category);
  const anim = useFadeIn(delay);
  return (
    <Animated.View style={[styles.expenseRow, anim]}>
      <View style={[styles.iconBox, { backgroundColor: meta.color + "22" }]}>
        <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {expense.title}
        </Text>
        <Text style={styles.rowSub}>
          {expense.category}
          {showDate ? ` · ${expense.date}` : ""}
          {expense.note ? ` · ${expense.note}` : ""}
        </Text>
      </View>
      <Text style={[styles.rowAmount, { color: meta.color }]}>
        -{formatPHP(expense.amount)}
      </Text>
    </Animated.View>
  );
}

function SectionHeader({ title, inline }) {
  if (inline) return <Text style={styles.sectionHeaderInline}>{title}</Text>;
  return <Text style={styles.sectionHeaderBlock}>{title}</Text>;
}

function FieldLabel({ label }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function EmptyState({ message }) {
  return (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 40, marginBottom: 10 }}>🌿</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

function StatTile({ label, value, color, icon }) {
  return (
    <View style={styles.statTile}>
      <Text style={{ fontSize: 22, marginBottom: 4 }}>{icon}</Text>
      <Text style={[styles.statTileVal, { color }]}>{value}</Text>
      <Text style={styles.statTileLabel}>{label}</Text>
    </View>
  );
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  // Toast
  toast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: T.success,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    zIndex: 999,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  toastText: { color: "white", fontFamily: "DMSans_700Bold", fontSize: 14 },

  // Tab Bar
  tabBar: {
    flexDirection: "row",
    height: 80,
    backgroundColor: T.surface,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingBottom: 16,
    paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabLabel: {
    fontSize: 10,
    fontFamily: "DMSans_500Medium",
    color: T.subtext,
    marginTop: 3,
  },
  addTabBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },

  // Home
  homeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  homeGreeting: { fontSize: 22, fontFamily: "DMSans_700Bold", color: T.text },
  homeSubGreeting: {
    fontSize: 13,
    fontFamily: "DMSans_400Regular",
    color: T.subtext,
    marginTop: 2,
  },
  budgetEditBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
  },

  budgetCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 22,
    backgroundColor: T.accent,
    borderRadius: 24,
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  budgetCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  budgetCardLabel: {
    fontSize: 12,
    fontFamily: "DMSans_500Medium",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  budgetCardAmount: {
    fontSize: 32,
    fontFamily: "DMSans_700Bold",
    color: "white",
    letterSpacing: -1,
  },
  budgetCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  budgetCirclePct: {
    fontSize: 16,
    fontFamily: "DMSans_700Bold",
    color: "white",
  },
  budgetCircleLabel: {
    fontSize: 9,
    fontFamily: "DMSans_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  budgetCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  budgetCardSub: {
    fontSize: 12,
    fontFamily: "DMSans_500Medium",
    color: "rgba(255,255,255,0.75)",
  },

  quickStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  quickStatCard: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: T.card,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: T.border,
  },
  quickStatIcon: { fontSize: 22, marginBottom: 6 },
  quickStatVal: {
    fontSize: 13,
    fontFamily: "DMSans_700Bold",
    color: T.text,
    textAlign: "center",
  },
  quickStatLabel: {
    fontSize: 10,
    fontFamily: "DMSans_400Regular",
    color: T.subtext,
    marginTop: 2,
    textAlign: "center",
  },

  catChip: {
    backgroundColor: T.card,
    borderRadius: 16,
    padding: 14,
    marginRight: 10,
    width: 110,
    borderWidth: 1,
    alignItems: "center",
  },
  catChipIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  catChipName: {
    fontSize: 12,
    fontFamily: "DMSans_700Bold",
    color: T.text,
    marginBottom: 4,
  },
  catChipAmt: { fontSize: 11, fontFamily: "DMSans_500Medium" },

  recentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
  },
  seeAll: { color: T.accentLt, fontFamily: "DMSans_700Bold", fontSize: 13 },

  // Inputs
  input: {
    backgroundColor: T.card,
    color: T.text,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: T.border,
    fontFamily: "DMSans_500Medium",
    fontSize: 16,
  },
  amountInput: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
    letterSpacing: -0.5,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "DMSans_700Bold",
    color: T.subtext,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  catSelectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  catSelectBtn: {
    width: "23%",
    backgroundColor: T.card,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: T.border,
  },
  catSelectText: {
    fontSize: 10,
    fontFamily: "DMSans_700Bold",
    marginTop: 6,
    color: T.subtext,
  },

  saveBtn: {
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtnText: { color: "white", fontFamily: "DMSans_700Bold", fontSize: 16 },

  // History
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: T.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    color: T.text,
    fontFamily: "DMSans_500Medium",
    fontSize: 15,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.card,
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: 1,
    borderColor: T.border,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: "DMSans_700Bold",
    color: T.subtext,
  },
  resultSummary: {
    fontSize: 12,
    fontFamily: "DMSans_500Medium",
    color: T.subtext,
    marginBottom: 12,
  },

  // Swipeable delete
  deleteUnderlay: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: T.danger + "22",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: { alignItems: "center" },
  deleteBtnIcon: { fontSize: 20 },
  deleteBtnText: {
    fontSize: 10,
    color: T.danger,
    fontFamily: "DMSans_700Bold",
    marginTop: 2,
  },

  // Expense Row
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.card,
    padding: 16,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.border,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: "DMSans_700Bold",
    color: T.text,
    marginBottom: 2,
  },
  rowSub: { fontSize: 12, fontFamily: "DMSans_500Medium", color: T.subtext },
  rowAmount: { fontSize: 15, fontFamily: "DMSans_700Bold", marginLeft: 8 },

  // Stats
  statsCard: {
    backgroundColor: T.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: T.border,
  },
  statsCardTitle: {
    fontSize: 13,
    fontFamily: "DMSans_700Bold",
    color: T.subtext,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statTile: { flex: 1, alignItems: "center" },
  statTileVal: { fontSize: 15, fontFamily: "DMSans_700Bold", marginBottom: 2 },
  statTileLabel: {
    fontSize: 11,
    fontFamily: "DMSans_500Medium",
    color: T.subtext,
  },
  statsNote: { fontSize: 13, fontFamily: "DMSans_500Medium", color: T.subtext },

  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  barChartCol: { flex: 1, alignItems: "center", marginHorizontal: 3 },
  barChartVal: {
    fontSize: 8,
    fontFamily: "DMSans_500Medium",
    color: T.subtext,
    marginBottom: 4,
    textAlign: "center",
  },
  barChartLabel: {
    fontSize: 11,
    fontFamily: "DMSans_500Medium",
    color: T.subtext,
    marginTop: 6,
  },

  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
    marginBottom: 6,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  legendText: {
    fontSize: 11,
    fontFamily: "DMSans_500Medium",
    color: T.subtext,
  },

  donutCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  donutTotal: { fontSize: 16, fontFamily: "DMSans_700Bold", color: T.text },
  donutLabel: {
    fontSize: 11,
    fontFamily: "DMSans_400Regular",
    color: T.subtext,
  },

  catStatRow: {
    backgroundColor: T.card,
    padding: 16,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.border,
  },
  catStatHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  catStatName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "DMSans_500Medium",
    color: T.text,
  },
  catStatAmt: { fontSize: 15, fontFamily: "DMSans_700Bold" },
  catStatPct: {
    fontSize: 11,
    color: T.subtext,
    fontFamily: "DMSans_500Medium",
    textAlign: "right",
  },

  // Progress bars
  barBg: { backgroundColor: T.border, borderRadius: 6, overflow: "hidden" },
  barFill: { borderRadius: 6 },

  // Profile
  profileCard: {
    backgroundColor: T.card,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: T.border,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: T.accent + "33",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  profileName: {
    fontSize: 20,
    fontFamily: "DMSans_700Bold",
    color: T.text,
    marginBottom: 4,
  },
  profileSub: {
    fontSize: 13,
    fontFamily: "DMSans_400Regular",
    color: T.subtext,
  },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.card,
    padding: 16,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.border,
  },
  settingLabel: {
    fontSize: 14,
    fontFamily: "DMSans_700Bold",
    color: T.text,
    marginBottom: 2,
  },
  settingValue: {
    fontSize: 13,
    fontFamily: "DMSans_500Medium",
    color: T.subtext,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: T.card,
    borderRadius: 24,
    padding: 28,
    width: SCREEN_WIDTH - 48,
    borderWidth: 1,
    borderColor: T.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: T.text,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: T.surface,
    color: T.text,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: T.border,
    fontFamily: "DMSans_700Bold",
    fontSize: 20,
  },
  modalSaveBtn: {
    backgroundColor: T.accent,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  modalSaveBtnText: {
    color: "white",
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
  },

  // Helpers
  screenTitle: {
    fontSize: 26,
    fontFamily: "DMSans_700Bold",
    color: T.text,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  sectionHeaderInline: {
    fontSize: 13,
    fontFamily: "DMSans_700Bold",
    color: T.subtext,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionHeaderBlock: {
    fontSize: 13,
    fontFamily: "DMSans_700Bold",
    color: T.subtext,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyText: {
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    color: T.subtext,
    textAlign: "center",
  },
});
