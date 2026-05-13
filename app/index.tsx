import {
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    useFonts,
} from "@expo-google-fonts/dm-sans";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

// Constants
const MONTHLY_BUDGET = 8000;
const CATEGORIES = [
  { name: "Food", icon: "🍔", color: "#FF6B6B" },
  { name: "Transport", icon: "🚗", color: "#4ECDC4" },
  { name: "Shopping", icon: "🛍️", color: "#A78BFA" },
  { name: "Bills", icon: "💡", color: "#F59E0B" },
  { name: "Health", icon: "🏥", color: "#34D399" },
  { name: "Other", icon: "📦", color: "#94A3B8" },
];

const INITIAL_EXPENSES = [
  {
    id: 1,
    title: "Grocery Run",
    amount: 48.5,
    category: "Food",
    date: "2026-05-13",
    note: "Weekly groceries",
  },
];

// Helper Functions
const formatPHP = (amt) =>
  `₱${Number(amt).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

// --- Main App Component ---
export default function App() {
  const [screen, setScreen] = useState("home");
  const [expenses, setExpenses] = useState([]);

  // Load Fonts
  let [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  // Persistence Logic (Mobile Version)
  useEffect(() => {
    const loadData = async () => {
      try {
        const saved = await AsyncStorage.getItem("expenses");
        if (saved) setExpenses(JSON.parse(saved));
        else setExpenses(INITIAL_EXPENSES);
      } catch (e) {
        Alert.alert("Error", "Failed to load data");
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("expenses", JSON.stringify(expenses));
  }, [expenses]);

  if (!fontsLoaded) return null;

  // Handlers
  const addExpense = (newExp) => {
    const item = {
      ...newExp,
      id: Date.now(),
      date: new Date().toISOString().split("T")[0],
    };
    setExpenses([item, ...expenses]);
  };

  const deleteExpense = (id) => {
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {/* Content Area */}
      <View style={styles.content}>
        {screen === "home" && (
          <HomeScreen expenses={expenses} setScreen={setScreen} />
        )}
        {screen === "add" && (
          <AddScreen onAdd={addExpense} setScreen={setScreen} />
        )}
        {screen === "history" && (
          <HistoryScreen expenses={expenses} onDelete={deleteExpense} />
        )}
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {["home", "history", "add", "stats"].map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setScreen(tab)}
            style={styles.tabItem}
          >
            <Text style={{ fontSize: 24, opacity: screen === tab ? 1 : 0.4 }}>
              {tab === "home"
                ? "🏠"
                : tab === "history"
                  ? "📋"
                  : tab === "add"
                    ? "➕"
                    : "📊"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

// --- Sub-Screens ---

function HomeScreen({ expenses, setScreen }) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = MONTHLY_BUDGET - total;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.budgetCard}>
        <Text style={styles.budgetLabel}>May 2026 Budget</Text>
        <Text style={styles.budgetAmount}>{formatPHP(remaining)}</Text>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min((total / MONTHLY_BUDGET) * 100, 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.budgetSubText}>Spent: {formatPHP(total)}</Text>
      </View>

      <Text style={styles.sectionHeader}>Top Categories</Text>
      <View style={styles.catGrid}>
        {CATEGORIES.slice(0, 3).map((c) => (
          <View key={c.name} style={styles.catCard}>
            <Text style={{ fontSize: 20 }}>{c.icon}</Text>
            <Text style={styles.catName}>{c.name}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function AddScreen({ onAdd, setScreen }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");

  const handleSave = () => {
    if (!title || !amount)
      return Alert.alert("Error", "Please fill all fields");
    onAdd({ title, amount: parseFloat(amount), category });
    setScreen("home");
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={styles.sectionHeader}>Add Expense</Text>
      <TextInput
        placeholder="Title"
        style={styles.input}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        placeholder="Amount"
        style={styles.input}
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Save Expense</Text>
      </TouchableOpacity>
    </View>
  );
}

function HistoryScreen({ expenses, onDelete }) {
  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={styles.sectionHeader}>All Transactions</Text>
      {expenses.map((e) => (
        <View key={e.id} style={styles.historyRow}>
          <View>
            <Text style={styles.rowTitle}>{e.title}</Text>
            <Text style={styles.rowSub}>{e.category}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.rowAmount}>-{formatPHP(e.amount)}</Text>
            <TouchableOpacity onPress={() => onDelete(e.id)}>
              <Text style={{ color: "red", fontSize: 10 }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAF8" },
  content: { flex: 1, paddingTop: 40 },
  budgetCard: {
    margin: 20,
    padding: 25,
    backgroundColor: "#1E1B4B",
    borderRadius: 24,
    elevation: 8,
  },
  budgetLabel: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: "DMSans_400Regular",
  },
  budgetAmount: {
    color: "white",
    fontSize: 32,
    fontFamily: "DMSans_700Bold",
    marginVertical: 10,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", backgroundColor: "#4ECDC4" },
  budgetSubText: { color: "white", marginTop: 10, fontSize: 12 },
  sectionHeader: {
    marginHorizontal: 20,
    fontSize: 14,
    fontFamily: "DMSans_700Bold",
    textTransform: "uppercase",
    color: "#64748B",
  },
  catGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
  },
  catCard: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 16,
    width: "30%",
    alignItems: "center",
  },
  catName: { fontSize: 10, marginTop: 5, fontFamily: "DMSans_500Medium" },
  tabBar: {
    flexDirection: "row",
    height: 70,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "white",
    paddingBottom: 10,
  },
  tabItem: { flex: 1, justifyContent: "center", alignItems: "center" },
  input: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  saveBtn: {
    backgroundColor: "#4338CA",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  saveBtnText: { color: "white", fontFamily: "DMSans_700Bold" },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  rowTitle: { fontFamily: "DMSans_500Medium", fontSize: 16 },
  rowSub: { color: "#64748B", fontSize: 12 },
  rowAmount: { color: "#EF4444", fontFamily: "DMSans_700Bold" },
});
