import React, { useState, useEffect } from "react";
import {
  Row, Col, Card, Typography, Space, Button, Table, Tag, Progress,
  Input, Modal, Tabs, Alert, message, Tooltip, Badge, Form, Select,
  Divider, Spin, Statistic, Empty
} from "antd";
import {
  EyeOutlined, SyncOutlined, PlusOutlined, ThunderboltOutlined,
  FireOutlined, DollarOutlined, GlobalOutlined, TrophyOutlined,
  CompassOutlined, ArrowUpOutlined, LinkOutlined, CheckCircleOutlined,
  SearchOutlined, ShoppingCartOutlined, AppstoreOutlined,
  CodeOutlined, TagOutlined, SafetyCertificateOutlined,
  FileTextOutlined, RiseOutlined, DesktopOutlined, ShopOutlined
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text, Paragraph } = Typography;

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000');
const API_BASE = `${SERVER_BASE}/api/v1/marketing/competitor`;

export const CompetitorSpyPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [winningAds, setWinningAds] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [trends, setTrends] = useState<any>({ google_trends: [], search_trends: [] });
  const [googleAds, setGoogleAds] = useState<any[]>([]);
  const [websiteAnalysis, setWebsiteAnalysis] = useState<any[]>([]);
  const [syncingAll, setSyncingAll] = useState<boolean>(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  // Add Competitor Modal
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [form] = Form.useForm();
  const [submittingAdd, setSubmittingAdd] = useState<boolean>(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<string>("overview");

  const getAuthHeaders = () => {
    const token = localStorage.getItem("poshplex_access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [compRes, winRes, insRes, trendsRes, googleRes, webRes] = await Promise.all([
        axios.get(`${API_BASE}/list`, { headers }),
        axios.get(`${API_BASE}/winning-ads`, { headers }),
        axios.get(`${API_BASE}/insights`, { headers }),
        axios.get(`${API_BASE}/trends`, { headers }),
        axios.get(`${API_BASE}/google-ads`, { headers }),
        axios.get(`${API_BASE}/website-analysis`, { headers }),
      ]);

      setCompetitors(compRes.data || []);
      setWinningAds(winRes.data || []);
      setInsights(insRes.data || []);
      setTrends(trendsRes.data || { google_trends: [], search_trends: [] });
      setGoogleAds(googleRes.data || []);
      setWebsiteAnalysis(webRes.data || []);
    } catch (err: any) {
      console.error("Failed loading competitor data:", err);
      message.error("Failed to load competitor intelligence. Check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      await axios.post(`${API_BASE}/sync-all`, {}, { headers: getAuthHeaders() });
      message.success("Multi-source sync (Meta + Google + Website) completed!");
      await fetchData();
    } catch (err: any) {
      message.error("Sync failed: " + (err.response?.data?.message || err.message));
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSyncSingle = async (competitorId: number, name: string) => {
    setSyncingId(competitorId);
    try {
      await axios.post(`${API_BASE}/${competitorId}/sync`, {}, { headers: getAuthHeaders() });
      message.success(`Synced ${name} Meta All Products, Google & Website platforms!`);
      await fetchData();
    } catch (err: any) {
      message.error(`Failed to sync ${name}: ` + (err.response?.data?.message || err.message));
    } finally {
      setSyncingId(null);
    }
  };

  const handleCreateCompetitor = async (values: any) => {
    setSubmittingAdd(true);
    try {
      await axios.post(`${API_BASE}/create`, values, { headers: getAuthHeaders() });
      message.success(`Added ${values.name} to Meta & Google intelligence radar!`);
      setAddModalOpen(false);
      form.resetFields();
      await fetchData();
    } catch (err: any) {
      message.error("Failed to create competitor: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Top Metrics
  const totalCompetitors = competitors.length;
  const totalMetaAds = competitors.reduce((acc, c) => acc + (c.active_meta_ads_count || 0), 0);
  const totalGoogleAds = competitors.reduce((acc, c) => acc + (c.active_google_ads_count || 0), 0);
  const totalCatalogProducts = competitors.reduce((acc, c) => acc + (c.website_products_count || 0), 0);
  const totalWinning = winningAds.length;
  const highThreatCount = competitors.filter(c => (c.threat_score || 0) >= 70).length;

  const threatColor = (score: number) => {
    if (score >= 70) return "#ef4444";
    if (score >= 40) return "#f59e0b";
    return "#10b981";
  };

  const platformBadgeColor = (platform: string) => {
    const p = (platform || "").toLowerCase();
    if (p.includes("shopify")) return "#10b981";
    if (p.includes("woo")) return "#8b5cf6";
    if (p.includes("next")) return "#06b6d4";
    if (p.includes("magento")) return "#f97316";
    return "#64748b";
  };

  const competitorColumns = [
    {
      title: "Competitor Brand",
      key: "name",
      render: (_: any, record: any) => (
        <Space direction="vertical" size={2}>
          <Space>
            <Text strong style={{ fontSize: 15, color: "#fff" }}>{record.name}</Text>
            {record.threat_score >= 70 && (
              <Tag color="error" icon={<FireOutlined />}>HIGH THREAT</Tag>
            )}
          </Space>
          <Space size={6} wrap>
            <Tag
              style={{
                borderRadius: 4,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderColor: platformBadgeColor(record.website_platform),
                color: platformBadgeColor(record.website_platform),
                fontSize: 11,
              }}
              icon={<CodeOutlined />}
            >
              {record.website_platform || "Shopify"}
            </Tag>
            {record.website_url && (
              <a
                href={record.website_url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: "#9ca3af", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <GlobalOutlined /> Storefront
              </a>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: "Category",
      dataIndex: "primary_category",
      key: "primary_category",
      render: (cat: string) => <Tag color="blue">{cat || "STREETWEAR"}</Tag>,
    },
    {
      title: "Meta All Products",
      dataIndex: "active_meta_ads_count",
      key: "active_meta_ads_count",
      render: (val: number) => (
        <Tag color="cyan" icon={<AppstoreOutlined />}>
          {val || 0} Active Creatives
        </Tag>
      ),
    },
    {
      title: "Google All Products",
      dataIndex: "active_google_ads_count",
      key: "active_google_ads_count",
      render: (val: number) => (
        <Tag color="geekblue" icon={<SearchOutlined />}>
          {val || 0} PLA / Search
        </Tag>
      ),
    },
    {
      title: "Website Catalog",
      dataIndex: "website_products_count",
      key: "website_products_count",
      render: (val: number) => (
        <Tag color="purple" icon={<ShopOutlined />}>
          ~{val || 0} Products
        </Tag>
      ),
    },
    {
      title: "Avg Running Days",
      dataIndex: "avg_ad_running_days",
      key: "avg_ad_running_days",
      render: (val: number) => <Text style={{ color: "#d1d5db" }}>{val ? `${val}d` : "—"}</Text>,
    },
    {
      title: "Lindy Winning Ads",
      dataIndex: "winning_ads_count",
      key: "winning_ads_count",
      render: (val: number) => (
        <Tag color={val > 0 ? "gold" : "default"} icon={<TrophyOutlined />}>
          {val || 0} (≥30d)
        </Tag>
      ),
    },
    {
      title: "Threat Score",
      dataIndex: "threat_score",
      key: "threat_score",
      render: (score: number) => (
        <div style={{ width: 130 }}>
          <Space size={4} style={{ marginBottom: 2 }}>
            <Text strong style={{ color: threatColor(score) }}>{score || 0} / 100</Text>
          </Space>
          <Progress
            percent={score || 0}
            size="small"
            strokeColor={threatColor(score)}
            showInfo={false}
          />
        </div>
      ),
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: any) => (
        <Button
          size="small"
          type="primary"
          ghost
          icon={<SyncOutlined spin={syncingId === record.id} />}
          onClick={() => handleSyncSingle(record.id, record.name)}
          loading={syncingId === record.id}
          style={{ borderColor: "#8b5cf6", color: "#c084fc" }}
        >
          Sync
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", backgroundColor: "#09090b" }}>
      {/* Brand Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <Space align="center" size={10}>
            <Title level={2} style={{ margin: 0, color: "#fff", fontWeight: 700, letterSpacing: "-0.5px" }}>
              Meta Engine - Competitor Spy
            </Title>
            <Tag color="#722ed1" icon={<EyeOutlined />} style={{ borderRadius: 12, padding: "2px 10px", fontSize: 12 }}>
              v4.2 Multi-Channel Radar
            </Tag>
          </Space>
          <Paragraph type="secondary" style={{ margin: "4px 0 0 0", fontSize: 14, color: "#a1a1aa" }}>
            AI watches Meta All Products + Google All Products (Shopping & Search) + Competitor Storefront Platforms 24/7 to reverse-engineer winning hooks, catalog pricing, and tech stacks.
          </Paragraph>
        </div>

        <Space size={12}>
          <Button
            icon={<SyncOutlined spin={syncingAll} />}
            onClick={handleSyncAll}
            loading={syncingAll}
            style={{ borderRadius: 6, borderColor: "#3f3f46", color: "#e4e4e7" }}
          >
            Sync All Channels
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddModalOpen(true)}
            style={{ borderRadius: 6, backgroundColor: "#722ed1", borderColor: "#722ed1" }}
          >
            Add Competitor
          </Button>
        </Space>
      </div>

      {/* KPI Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ backgroundColor: "#141418", borderColor: "#27272a", borderRadius: 8 }}>
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              <Text type="secondary" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Monitored Brands
              </Text>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Title level={2} style={{ margin: 0, color: "#fff" }}>{totalCompetitors}</Title>
                <Tag color="purple">Active Radar</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 12, color: "#71717a" }}>
                Fabrilife, Sailor, Klothe, Richman
              </Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card style={{ backgroundColor: "#141418", borderColor: "#27272a", borderRadius: 8 }}>
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              <Text type="secondary" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Meta All Products Ads
              </Text>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Title level={2} style={{ margin: 0, color: "#06b6d4" }}>{totalMetaAds}</Title>
                <Tag color="cyan">Ad Library + DPA</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 12, color: "#71717a" }}>
                Images, Reels, Carousels & Dynamic Catalog
              </Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card style={{ backgroundColor: "#141418", borderColor: "#27272a", borderRadius: 8 }}>
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              <Text type="secondary" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Google All Products Ads
              </Text>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Title level={2} style={{ margin: 0, color: "#3b82f6" }}>{totalGoogleAds}</Title>
                <Tag color="blue">Shopping PLA + Search</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 12, color: "#71717a" }}>
                Merchant Center & Search Keywords
              </Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card style={{ backgroundColor: "#141418", borderColor: "#27272a", borderRadius: 8 }}>
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              <Text type="secondary" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Website Catalog Tracked
              </Text>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Title level={2} style={{ margin: 0, color: "#10b981" }}>{totalCatalogProducts.toLocaleString()}</Title>
                <Tag color="green">Live Products</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 12, color: "#71717a" }}>
                Shopify, WooCommerce, Next.js, Magento
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Main Tabs Navigation */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        style={{ marginBottom: 24 }}
        items={[
          { key: "overview", label: "Competitor Threat Board" },
          { key: "winning_ads", label: `Winning Ads Gallery (${totalWinning})` },
          { key: "google_intel", label: "Google All Products (Shopping & Search)" },
          { key: "website_platform", label: "Website Platform Analysis" },
          { key: "gaps", label: `AI Strategic Insights & Price Gaps (${insights.length})` },
        ]}
      />

      {/* Tab 1: Competitor Threat Board */}
      {activeTab === "overview" && (
        <Card
          title={<Text strong style={{ color: "#fff", fontSize: 16 }}>Competitor Threat Leaderboard</Text>}
          style={{ backgroundColor: "#141418", borderColor: "#27272a", borderRadius: 8 }}
        >
          <Table
            dataSource={competitors}
            columns={competitorColumns}
            rowKey="id"
            loading={loading}
            pagination={false}
          />
        </Card>
      )}

      {/* Tab 2: Winning Ads Gallery (Lindy 30-Day Rule) */}
      {activeTab === "winning_ads" && (
        <div>
          <Alert
            message="The 30-Day Lindy Ad Rule (Meta & Google)"
            description="Any ad running for 30+ days is proven profitable in Bangladesh fashion & streetwear. Competitors kill losing ads in 3-7 days. Reverse-engineer their hooks, angles, and formats for PoshPlex campaigns."
            type="info"
            showIcon
            style={{ marginBottom: 20, backgroundColor: "#18181b", borderColor: "#3f3f46" }}
          />

          <Row gutter={[16, 16]}>
            {winningAds.map((ad: any) => (
              <Col xs={24} md={12} lg={8} key={ad.id}>
                <Card
                  style={{
                    backgroundColor: "#18181b",
                    borderColor: "#27272a",
                    borderRadius: 8,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                  bodyStyle={{ display: "flex", flexDirection: "column", flexGrow: 1 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <Space>
                      <Tag color={ad.platform === "META" ? "blue" : "cyan"}>
                        {ad.platform === "META" ? "Meta Ad Library" : "Google Search / PLA"}
                      </Tag>
                      <Text strong style={{ color: "#fff" }}>{ad.competitor_name}</Text>
                    </Space>
                    <Tag color="gold" icon={<TrophyOutlined />}>
                      {ad.days_running} Days Running
                    </Tag>
                  </div>

                  {ad.headline && (
                    <Text strong style={{ color: "#f4f4f5", fontSize: 15, marginBottom: 8, display: "block" }}>
                      {ad.headline}
                    </Text>
                  )}

                  <Paragraph
                    style={{ color: "#a1a1aa", fontSize: 13, flexGrow: 1, marginBottom: 12 }}
                    ellipsis={{ rows: 3, expandable: true, symbol: "more" }}
                  >
                    {ad.ad_text}
                  </Paragraph>

                  {ad.raw_metadata?.sitelinks && ad.raw_metadata.sitelinks.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                        Google Ad Sitelinks:
                      </Text>
                      <Space size={4} wrap>
                        {ad.raw_metadata.sitelinks.map((s: string, sIdx: number) => (
                          <Tag key={sIdx} color="default" style={{ fontSize: 11 }}>
                            {s}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  )}

                  <div style={{ backgroundColor: "#27272a", padding: "10px 12px", borderRadius: 6, marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", display: "block", color: "#a1a1aa" }}>
                      AI Hook & Angle Analysis
                    </Text>
                    <Text style={{ fontSize: 12, color: "#e4e4e7" }}>
                      {ad.ai_hook_analysis || "Problem-calling angle showing fabric GSM close-up."}
                    </Text>
                  </div>

                  <Button
                    type="dashed"
                    block
                    icon={<ThunderboltOutlined />}
                    onClick={() => {
                      message.info(`Hook angle '${ad.ai_angle || "Streetwear"}' copied! Ready for Meta Agent copywriter.`);
                    }}
                    style={{ borderColor: "#722ed1", color: "#c084fc" }}
                  >
                    Adapt Angle for PoshPlex
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* Tab 3: Google All Products & Search Intelligence */}
      {activeTab === "google_intel" && (
        <div>
          {/* Section 1: Bangladesh Google Search Momentum */}
          <Title level={4} style={{ color: "#fff", marginBottom: 16 }}>
            <SearchOutlined style={{ color: "#38bdf8", marginRight: 8 }} />
            Bangladesh Google Search & Shopping Trends (BD Apparel & Streetwear)
          </Title>

          <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
            {(trends.google_trends || []).map((t: any, idx: number) => (
              <Col xs={24} md={12} lg={6} key={idx}>
                <Card style={{ backgroundColor: "#141418", borderColor: "#27272a", borderRadius: 8, height: "100%" }}>
                  <Space direction="vertical" style={{ width: "100%" }} size={6}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Text strong style={{ color: "#fff", fontSize: 14 }}>{t.query}</Text>
                      <Tag color="cyan">{t.growth_mom}</Tag>
                    </div>

                    <div style={{ padding: "8px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#9ca3af" }}>Monthly Volume:</span>
                        <strong style={{ color: "#38bdf8" }}>{t.monthly_searches}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
                        <span style={{ color: "#9ca3af" }}>Est. CPC:</span>
                        <strong style={{ color: "#facc15" }}>{t.cpc_estimate_bdt}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
                        <span style={{ color: "#9ca3af" }}>Top Bidders:</span>
                        <span style={{ color: "#e5e7eb" }}>{t.top_competitor_bidding}</span>
                      </div>
                    </div>

                    <div style={{ backgroundColor: "#09090b", padding: "8px 10px", borderRadius: 6 }}>
                      <Text type="secondary" style={{ fontSize: 11, display: "block" }}>Recommended Headline:</Text>
                      <Text style={{ fontSize: 12, color: "#a78bfa" }}>{t.recommended_google_headline}</Text>
                    </div>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Section 2: Google Shopping Product Listing Ads (PLA) */}
          <Title level={4} style={{ color: "#fff", marginBottom: 16 }}>
            <ShoppingCartOutlined style={{ color: "#10b981", marginRight: 8 }} />
            Competitor Google Shopping (PLA) Active Feed Products
          </Title>

          <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
            {googleAds.flatMap((c: any) =>
              (c.shopping_products || []).map((prod: any, pIdx: number) => (
                <Col xs={24} sm={12} lg={8} key={`${c.competitor_id}-${pIdx}`}>
                  <Card style={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: 8 }}>
                    <div style={{ display: "flex", gap: 14 }}>
                      <img
                        src={prod.image_url}
                        alt={prod.product_title}
                        style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, backgroundColor: "#27272a" }}
                      />
                      <div style={{ flex: 1 }}>
                        <Tag color="blue" style={{ fontSize: 11, marginBottom: 4 }}>{c.competitor_name}</Tag>
                        <Text strong style={{ color: "#fff", display: "block", fontSize: 13, lineHeight: 1.3 }}>
                          {prod.product_title}
                        </Text>
                        <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "#10b981", fontWeight: 700, fontSize: 15 }}>
                            ৳{prod.price?.toLocaleString()} BDT
                          </span>
                          <Tag color="gold" style={{ fontSize: 11 }}>★ {prod.rating} ({prod.reviews_count})</Tag>
                        </div>
                      </div>
                    </div>
                    <Divider style={{ borderColor: "#27272a", margin: "10px 0" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af" }}>
                      <span>Format: {prod.ad_format}</span>
                      <span style={{ color: "#34d399" }}>● {prod.availability}</span>
                    </div>
                  </Card>
                </Col>
              ))
            )}
          </Row>

          {/* Section 3: Google Search Text Ads */}
          <Title level={4} style={{ color: "#fff", marginBottom: 16 }}>
            <CodeOutlined style={{ color: "#f59e0b", marginRight: 8 }} />
            Active Google Search Ads & Extensions
          </Title>

          <Row gutter={[16, 16]}>
            {googleAds.flatMap((c: any) =>
              (c.search_ads || []).map((ad: any, aIdx: number) => (
                <Col xs={24} md={12} key={`${c.competitor_id}-ad-${aIdx}`}>
                  <Card style={{ backgroundColor: "#141418", borderColor: "#27272a", borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <Tag color="purple">{c.competitor_name}</Tag>
                      <Tag color="cyan">Google Search Ad</Tag>
                    </div>
                    <Text strong style={{ color: "#38bdf8", fontSize: 15, display: "block", marginBottom: 6 }}>
                      {ad.headline}
                    </Text>
                    <Paragraph style={{ color: "#a1a1aa", fontSize: 13, marginBottom: 10 }}>
                      {ad.text}
                    </Paragraph>
                    {ad.keywords && (
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        <span style={{ color: "#9ca3af" }}>Targeting:</span> {ad.keywords}
                      </div>
                    )}
                  </Card>
                </Col>
              ))
            )}
          </Row>
        </div>
      )}

      {/* Tab 4: Website Platform Analysis */}
      {activeTab === "website_platform" && (
        <div>
          <Alert
            message="Competitor Storefront & Platform Analysis"
            description="Deep scan of rival website technology stacks, detected eCommerce engines (Shopify, WooCommerce, Custom Next.js, Magento), catalog dimensions, and active promotional discount codes."
            type="info"
            showIcon
            style={{ marginBottom: 20, backgroundColor: "#18181b", borderColor: "#3f3f46" }}
          />

          <Row gutter={[16, 16]}>
            {websiteAnalysis.map((item: any) => (
              <Col xs={24} lg={12} key={item.competitor_id}>
                <Card
                  style={{
                    backgroundColor: "#18181b",
                    borderColor: "#27272a",
                    borderRadius: 8,
                    height: "100%",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                      <Space align="center">
                        <Title level={4} style={{ color: "#fff", margin: 0 }}>{item.competitor_name}</Title>
                        <Tag
                          style={{
                            borderColor: platformBadgeColor(item.website_platform),
                            color: platformBadgeColor(item.website_platform),
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            fontWeight: 600,
                          }}
                        >
                          {item.website_platform || "Shopify"}
                        </Tag>
                      </Space>
                      {item.website_url && (
                        <a
                          href={item.website_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 12, color: "#9ca3af", display: "inline-block", marginTop: 4 }}
                        >
                          <LinkOutlined /> {item.website_url}
                        </a>
                      )}
                    </div>
                    <Tag color="blue">{item.tech_stack?.cdn || "Cloudflare CDN"}</Tag>
                  </div>

                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <div style={{ backgroundColor: "#141418", padding: "10px 12px", borderRadius: 6 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>Catalog Size</Text>
                        <Title level={4} style={{ color: "#fff", margin: "2px 0 0 0" }}>
                          ~{item.website_products_count || 0}
                        </Title>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ backgroundColor: "#141418", padding: "10px 12px", borderRadius: 6 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>Avg Price</Text>
                        <Title level={4} style={{ color: "#10b981", margin: "2px 0 0 0" }}>
                          ৳{item.tech_stack?.avg_catalog_price || 1450}
                        </Title>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ backgroundColor: "#141418", padding: "10px 12px", borderRadius: 6 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>Price Range</Text>
                        <Title level={4} style={{ color: "#facc15", margin: "2px 0 0 0", fontSize: 13 }}>
                          {item.tech_stack?.price_range || "890 - 3,200"}
                        </Title>
                      </div>
                    </Col>
                  </Row>

                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ color: "#d1d5db", fontSize: 13, display: "block", marginBottom: 6 }}>
                      Active Storefront Discounts & Coupons:
                    </Text>
                    <Space size={6} wrap>
                      {(item.tech_stack?.active_promo_codes || []).map((p: any, pIdx: number) => (
                        <Tag key={pIdx} color="volcano" icon={<TagOutlined />}>
                          {p.code}: {p.offer}
                        </Tag>
                      ))}
                    </Space>
                  </div>

                  <div style={{ backgroundColor: "#141418", padding: "10px 14px", borderRadius: 6 }}>
                    <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Detected Tech Stack & Tracking Pixels:
                    </Text>
                    <Space size={8} wrap>
                      <Tag color={item.tech_stack?.meta_pixel_detected ? "cyan" : "default"}>
                        {item.tech_stack?.meta_pixel_detected ? "✓ Meta Pixel" : "✕ No Meta Pixel"}
                      </Tag>
                      <Tag color={item.tech_stack?.google_tag_manager ? "blue" : "default"}>
                        {item.tech_stack?.google_tag_manager ? "✓ Google Tag Manager" : "✕ No GTM"}
                      </Tag>
                      <Tag color={item.tech_stack?.google_analytics_4 ? "geekblue" : "default"}>
                        {item.tech_stack?.google_analytics_4 ? "✓ GA4 Analytics" : "✕ No GA4"}
                      </Tag>
                      <Tag color={item.tech_stack?.ssl_secured ? "green" : "red"}>
                        {item.tech_stack?.ssl_secured ? "✓ SSL Secured" : "✕ Insecure"}
                      </Tag>
                    </Space>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* Tab 5: AI Strategic Insights & Price Gaps */}
      {activeTab === "gaps" && (
        <div>
          <Row gutter={[16, 16]}>
            {insights.map((ins: any) => (
              <Col xs={24} md={12} key={ins.id}>
                <Card
                  style={{
                    backgroundColor: "#18181b",
                    borderColor: ins.insight_type === "PRICE_GAP" ? "#22c55e" : "#27272a",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <Space>
                      {ins.insight_type === "PRICE_GAP" ? (
                        <DollarOutlined style={{ fontSize: 18, color: "#22c55e" }} />
                      ) : (
                        <ThunderboltOutlined style={{ fontSize: 18, color: "#a855f7" }} />
                      )}
                      <div>
                        <Text strong style={{ color: "#fff", fontSize: 15 }}>{ins.title}</Text>
                        <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                          Target: {ins.competitor_name || "Market Benchmark"}
                        </Text>
                      </div>
                    </Space>
                    <Tag color={ins.insight_type === "PRICE_GAP" ? "green" : "purple"}>
                      {ins.insight_type}
                    </Tag>
                  </div>

                  <Paragraph style={{ color: "#d4d4d8", fontSize: 13, margin: "10px 0" }}>
                    {ins.description}
                  </Paragraph>

                  <div style={{ backgroundColor: "#09090b", padding: "10px 12px", borderRadius: 6, marginBottom: 12 }}>
                    <Text strong style={{ color: "#38bdf8", fontSize: 12 }}>Actionable Strategy:</Text>
                    <Paragraph style={{ color: "#f4f4f5", fontSize: 12, margin: "4px 0 0 0" }}>
                      {ins.actionable_recommendation}
                    </Paragraph>
                  </div>

                  {ins.suggested_ad_copy && (
                    <div style={{ backgroundColor: "#27272a", padding: "10px 12px", borderRadius: 6, marginBottom: 12 }}>
                      <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", display: "block" }}>
                        Suggested PoshPlex Counter-Ad Copy
                      </Text>
                      <Paragraph style={{ color: "#e4e4e7", fontSize: 12, margin: "4px 0 0 0", fontStyle: "italic" }}>
                        "{ins.suggested_ad_copy}"
                      </Paragraph>
                    </div>
                  )}

                  <Button
                    type="primary"
                    ghost
                    block
                    icon={<FileTextOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(ins.suggested_ad_copy || ins.actionable_recommendation);
                      message.success("Copied strategy & copy to clipboard!");
                    }}
                  >
                    Copy Counter-Ad Concept
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* Add Competitor Modal */}
      <Modal
        title="Add Competitor to Meta & Google Radar"
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateCompetitor}
          initialValues={{ primary_category: "STREETWEAR" }}
        >
          <Form.Item
            name="name"
            label="Brand Name"
            rules={[{ required: true, message: "Please input brand name" }]}
          >
            <Input placeholder="e.g. Fabrilife, Sailor, Klothe, Richman" />
          </Form.Item>

          <Form.Item name="meta_page_id" label="Meta Ad Library Page ID / Username">
            <Input placeholder="e.g. fabrilife.official or numeric ID" />
          </Form.Item>

          <Form.Item name="google_merchant_id" label="Google Merchant ID / Storefront Domain">
            <Input placeholder="e.g. sailor-clothing-bd" />
          </Form.Item>

          <Form.Item name="website_url" label="Storefront Website URL">
            <Input placeholder="https://example.com" />
          </Form.Item>

          <Form.Item name="primary_category" label="Category">
            <Select>
              <Select.Option value="STREETWEAR">Streetwear & Urban</Select.Option>
              <Select.Option value="DROP_SHOULDER">Drop Shoulder T-Shirts</Select.Option>
              <Select.Option value="HOODIE">Hoodies & Winterwear</Select.Option>
              <Select.Option value="CASUAL">Casual Wear</Select.Option>
              <Select.Option value="DENIM">Denim & Bottoms</Select.Option>
              <Select.Option value="LUXURY">Premium / Luxury Fashion</Select.Option>
            </Select>
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submittingAdd}
              style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
            >
              Add & Start Tracking
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default CompetitorSpyPage;
