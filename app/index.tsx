import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts,
} from "@expo-google-fonts/dm-sans";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
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

  // Persistence Logic
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
    Alert.alert("Delete Expense", "Are you sure you want to delete this?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => setExpenses(expenses.filter((e) => e.id !== id)),
      },
    ]);
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
        {screen === "stats" && <StatsScreen expenses={expenses} />}
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
  const total = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses],
  );
  const remaining = MONTHLY_BUDGET - total;
  const recent = expenses.slice(0, 3); // Get top 3 recent transactions

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

      <View style={styles.recentHeader}>
        <Text style={[styles.sectionHeader, { marginHorizontal: 0 }]}>
          Recent
        </Text>
        <TouchableOpacity onPress={() => setScreen("history")}>
          <Text style={styles.seeAllText}>See all →</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        {recent.length === 0 && (
          <Text style={styles.emptyText}>No expenses yet.</Text>
        )}
        {recent.map((e) => (
          <ExpenseRow key={e.id} expense={e} />
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
    if (!title || !amount) {
      return Alert.alert("Error", "Please fill out the title and amount.");
    }
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return Alert.alert("Error", "Please enter a valid amount.");
    }
    onAdd({ title, amount: parseFloat(amount), category });
    setScreen("home");
  };

  return (
    <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
      <Text
        style={[
          styles.sectionHeader,
          { marginHorizontal: 0, marginBottom: 15 },
        ]}
      >
        Add Expense
      </Text>

      <TextInput
        placeholder="What did you buy?"
        style={styles.input}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        placeholder="Amount (₱)"
        style={styles.input}
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />

      <Text
        style={[
          styles.sectionHeader,
          { marginHorizontal: 0, marginTop: 10, marginBottom: 10 },
        ]}
      >
        Category
      </Text>
      <View style={styles.catSelectGrid}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.name}
            onPress={() => setCategory(cat.name)}
            style={[
              styles.catSelectBtn,
              category === cat.name && {
                borderColor: cat.color,
                backgroundColor: cat.color + "1A",
              },
            ]}
          >
            <Text style={{ fontSize: 24 }}>{cat.icon}</Text>
            <Text
              style={[
                styles.catSelectText,
                category === cat.name && { color: cat.color },
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Save Expense</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function HistoryScreen({ expenses, onDelete }) {
  return (
    <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
      <Text
        style={[
          styles.sectionHeader,
          { marginHorizontal: 0, marginBottom: 15 },
        ]}
      >
        All Transactions
      </Text>
      {expenses.length === 0 && (
        <Text style={styles.emptyText}>No expenses yet.</Text>
      )}
      {expenses.map((e) => (
        <ExpenseRow key={e.id} expense={e} onDelete={onDelete} />
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function StatsScreen({ expenses }) {
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

  return (
    <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
      <Text
        style={[
          styles.sectionHeader,
          { marginHorizontal: 0, marginBottom: 15 },
        ]}
      >
        Statistics
      </Text>

      <View style={styles.statsCard}>
        <Text style={styles.statsLabel}>Total Spent</Text>
        <Text style={styles.statsAmount}>{formatPHP(total)}</Text>
        <Text style={styles.statsLabel}>Remaining Budget</Text>
        <Text
          style={[
            styles.statsAmount,
            { color: "#10B981", fontSize: 24, marginBottom: 0 },
          ]}
        >
          {formatPHP(Math.max(MONTHLY_BUDGET - total, 0))}
        </Text>
      </View>

      <Text
        style={[
          styles.sectionHeader,
          { marginHorizontal: 0, marginTop: 10, marginBottom: 10 },
        ]}
      >
        By Category
      </Text>
      {byCategory.length === 0 && (
        <Text style={styles.emptyText}>No data to show.</Text>
      )}
      {byCategory.map(([cat, amt]) => {
        const meta = CATEGORIES.find((c) => c.name === cat) || CATEGORIES[5];
        const pct = total > 0 ? amt / total : 0;
        return (
          <View key={cat} style={styles.catStatRow}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 24, marginRight: 10 }}>{meta.icon}</Text>
              <Text
                style={{
                  fontFamily: "DMSans_500Medium",
                  flex: 1,
                  fontSize: 16,
                }}
              >
                {cat}
              </Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{
                    fontFamily: "DMSans_700Bold",
                    color: meta.color,
                    fontSize: 16,
                  }}
                >
                  {formatPHP(amt)}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: "#94A3B8",
                    fontFamily: "DMSans_500Medium",
                  }}
                >
                  {Math.round(pct * 100)}%
                </Text>
              </View>
            </View>
            <View style={[styles.progressBarBg, { height: 6 }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${pct * 100}%`, backgroundColor: meta.color },
                ]}
              />
            </View>
          </View>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// Reusable component for displaying an expense
function ExpenseRow({ expense, onDelete }) {
  const meta =
    CATEGORIES.find((c) => c.name === expense.category) || CATEGORIES[5];
  return (
    <View style={styles.historyRow}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <View style={[styles.iconBox, { backgroundColor: meta.color + "22" }]}>
          <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
        </View>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {expense.title}
          </Text>
          <Text style={styles.rowSub}>{expense.category}</Text>
        </View>
      </View>
      <View style={{ alignItems: "flex-end", justifyContent: "center" }}>
        <Text style={styles.rowAmount}>-{formatPHP(expense.amount)}</Text>
        {onDelete && (
          <TouchableOpacity
            onPress={() => onDelete(expense.id)}
            style={{ paddingTop: 6, paddingBottom: 2, paddingLeft: 10 }}
          >
            <Text
              style={{
                color: "#EF4444",
                fontSize: 12,
                fontFamily: "DMSans_700Bold",
              }}
            >
              Delete
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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
    shadowColor: "#1E1B4B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  budgetLabel: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: "DMSans_400Regular",
  },
  budgetAmount: {
    color: "white",
    fontSize: 34,
    fontFamily: "DMSans_700Bold",
    marginVertical: 10,
    letterSpacing: -1,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#4ECDC4",
    borderRadius: 4,
  },
  budgetSubText: {
    color: "white",
    marginTop: 10,
    fontSize: 12,
    fontFamily: "DMSans_500Medium",
  },
  sectionHeader: {
    marginHorizontal: 20,
    fontSize: 13,
    fontFamily: "DMSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#64748B",
  },
  catGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 15,
  },
  catCard: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 16,
    width: "30%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  catName: {
    fontSize: 11,
    marginTop: 5,
    fontFamily: "DMSans_500Medium",
    color: "#475569",
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 5,
    marginBottom: 15,
  },
  seeAllText: {
    color: "#4338CA",
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
  },
  emptyText: {
    color: "#94A3B8",
    fontFamily: "DMSans_400Regular",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 10,
  },
  tabBar: {
    flexDirection: "row",
    height: 80,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "white",
    paddingBottom: 20,
    paddingTop: 10,
  },
  tabItem: { flex: 1, justifyContent: "center", alignItems: "center" },
  input: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontFamily: "DMSans_500Medium",
    fontSize: 16,
  },
  catSelectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  catSelectBtn: {
    width: "31%",
    backgroundColor: "white",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  catSelectText: {
    fontSize: 12,
    fontFamily: "DMSans_700Bold",
    marginTop: 6,
    color: "#64748B",
  },
  saveBtn: {
    backgroundColor: "#4338CA",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#4338CA",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: "white", fontFamily: "DMSans_700Bold", fontSize: 16 },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    color: "#0F172A",
    marginBottom: 2,
  },
  rowSub: { color: "#64748B", fontSize: 13, fontFamily: "DMSans_500Medium" },
  rowAmount: { color: "#EF4444", fontFamily: "DMSans_700Bold", fontSize: 16 },
  statsCard: {
    backgroundColor: "white",
    padding: 25,
    borderRadius: 24,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsLabel: {
    fontFamily: "DMSans_500Medium",
    color: "#64748B",
    fontSize: 13,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  catStatRow: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
});
