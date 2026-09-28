from pathlib import Path

p = Path(r"E:\Projects\leadflowpro\src\routes\dashboard.leadboard.tsx")
text = p.read_text(encoding="utf-8")
start = text.index("function Leadboard() {")
end = text.index("  const typeMap = useMemo(")

new_head = r'''function Leadboard() {
  const { user } = useAuth();
  const { quota: leadQuota, refresh: refreshQuota } = useQuota("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [productTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState<"all" | ProductCategory>("all");
  const [productTypeId, setProductTypeId] = useState<"all" | string>("all");
  const [score, setScore] = useState("all");
  const [maxBudget, setMaxBudget] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("all");
  const [buying, setBuying] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, hot: 0, purchases: 0, balance: 0 });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [purchased, setPurchased] = useState<Record<string, { full_phone: string }>>({});
  const [shortfallLead, setShortfallLead] = useState<Lead | null>(null);

  const filteredTypes = useMemo(
    () => (category === "all" ? productTypes : productTypes.filter((p) => p.category === category)),
    [productTypes, category],
  );

  const load = async () => {
    setLoading(true);
    try {
      const data = await listCrmLeads({ limit: 200 });
      let rows = data.items.map(mapCrmLead);

      if (city.trim()) {
        const c = city.trim().toLowerCase();
        rows = rows.filter((l) => l.city.toLowerCase().includes(c));
      }
      if (category !== "all") rows = rows.filter((l) => l.product_category === category);
      if (score !== "all") rows = rows.filter((l) => l.score === score);
      if (maxBudget && Number(maxBudget) > 0) {
        rows = rows.filter((l) => l.price <= Number(maxBudget));
      }
      const tr = TIME_RANGES.find((r) => r.key === timeRange);
      if (tr && tr.hours > 0) {
        const since = Date.now() - tr.hours * 3600_000;
        rows = rows.filter((l) => new Date(l.created_at).getTime() >= since);
      }

      const scoreRank = { hot: 3, warm: 2, cold: 1 } as const;
      rows = [...rows].sort((a, b) => {
        if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sort === "score") return scoreRank[b.score] - scoreRank[a.score];
        if (sort === "price_asc") return a.price - b.price;
        if (sort === "price_desc") return b.price - a.price;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setLeads(rows);
      setStats({
        total: data.total,
        hot: data.items.filter((l) => l.score === "hot").length,
        purchases: Object.keys(purchased).length,
        balance: 0,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load CRM leads");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, category, productTypeId, score, maxBudget, sort, timeRange]);

  useEffect(() => {
    setProductTypeId("all");
  }, [category]);

  const buy = async (lead: Lead) => {
    if (!user) return;
    if (purchased[lead.id]) return;
    setPurchased((prev) => ({
      ...prev,
      [lead.id]: { full_phone: lead.full_phone || lead.masked_phone },
    }));
    toast.success("Lead opened. Wallet purchase comes in next phase.");
  };

  const recharge = async (_amount: number) => {
    toast.info("Wallet recharge will move to Python CRM next.");
  };

'''

p.write_text(text[:start] + new_head + text[end:], encoding="utf-8")
print("ok supabase=", "supabase" in p.read_text(encoding="utf-8"))
