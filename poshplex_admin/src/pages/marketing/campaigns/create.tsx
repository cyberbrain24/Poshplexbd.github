import React, { useState, useEffect } from "react";
import {
  Steps, Form, Input, InputNumber, Select, Radio, Slider, Checkbox,
  Button, Card, Row, Col, Typography, Space, message, Tag, DatePicker,
  Divider, Drawer, Switch, Segmented, Alert, Tooltip
} from "antd";
import {
  RocketOutlined, CheckCircleOutlined, UsergroupAddOutlined, PictureOutlined,
  DollarOutlined, ThunderboltOutlined, ArrowLeftOutlined, ArrowRightOutlined,
  SaveOutlined, CloudUploadOutlined, BulbOutlined, CrownOutlined,
  SafetyCertificateOutlined, RobotOutlined, WarningOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AdMockupPreview } from "../components/AdMockupPreview";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000');
const API_BASE = `${SERVER_BASE}/api/v1/marketing`;
const CATALOG_API = `${SERVER_BASE}/api/v1/catalog`;

export const CampaignCreateWizard: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();

  // Data states
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [batchResults, setBatchResults] = useState<any>(null);
  const [selectedAngleTab, setSelectedAngleTab] = useState<string>("hype");
  const [isFirstTimeTest, setIsFirstTimeTest] = useState<boolean>(true);

  // Live preview tracking state
  const [previewData, setPreviewData] = useState({
    headline: "PoshPlex Heavyweight Signature Drop",
    primaryText: "Engineered streetwear for Dhaka streets. 240+ GSM combed compact cotton. Anti-shrink, heavy drop shoulder silhouette. Cash on delivery nationwide.",
    description: "STORE.POSHPLEXBD.COM",
    callToAction: "SHOP_NOW",
    imageUrl: "",
    productName: "PoshPlex Streetwear",
  });

  useEffect(() => {
    const token = localStorage.getItem("poshplex_access_token");
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch ad accounts
    axios.get(`${API_BASE}/ad-accounts/`, { headers })
      .then((res) => {
        setAdAccounts(res.data);
        if (res.data.length > 0) {
          form.setFieldsValue({ ad_account_id: res.data[0].id });
        }
      })
      .catch(() => {});

    // Fetch products
    axios.get(`${CATALOG_API}/products/`, { headers })
      .then((res) => {
        setProducts(res.data?.items || res.data || []);
      })
      .catch(() => {});

    // Fetch AI Status & Quota
    axios.get(`${API_BASE}/ai/status/`, { headers })
      .then((res) => {
        setAiStatus(res.data);
      })
      .catch(() => {});
  }, []);

  const handleProductSelect = (productId: number) => {
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      const img = prod.images && prod.images[0]?.image ? prod.images[0].image : "";
      const fullImgUrl = img.startsWith("http") ? img : `${SERVER_BASE}${img}`;

      setPreviewData((prev) => ({
        ...prev,
        productName: prod.name,
        headline: `${prod.name} | Limited Drop`,
        imageUrl: fullImgUrl,
      }));

      form.setFieldsValue({
        name: `${prod.name} - Meta Drop`,
        creative_headline: `${prod.name} | Limited Drop`,
        creative_image_url: fullImgUrl,
      });
    }
  };

  const handleApplyAngleCopy = (angleKey: string, dataObj?: any) => {
    const source = dataObj || (batchResults && batchResults[angleKey]);
    if (!source) return;

    const headline = source.headlines?.[0] || previewData.headline;
    const primaryText = source.primary_texts?.[0] || previewData.primaryText;
    const cta = source.call_to_action || previewData.callToAction;

    form.setFieldsValue({
      creative_headline: headline,
      creative_primary_text: primaryText,
      creative_cta: cta,
      interests: source.recommended_targeting?.interests || form.getFieldValue("interests"),
    });

    setPreviewData((prev) => ({
      ...prev,
      headline,
      primaryText,
      callToAction: cta,
    }));
    setSelectedAngleTab(angleKey);
  };

  const handleGenerateAI = async (angle: string = "hype", batchAll: boolean = false, premiumRewrite: boolean = false) => {
    if (aiStatus && !aiStatus.is_available) {
      message.error("AI Copy generation is paused - daily budget limit ($2.00) reached.");
      return;
    }

    setAiLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const productId = form.getFieldValue("linked_product_id");

      const res = await axios.post(
        `${API_BASE}/ai/generate-copy/`,
        {
          product_id: productId,
          angle,
          batch_all_angles: batchAll,
          premium_rewrite: premiumRewrite
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = res.data;

      if (batchAll && data.batch_angles) {
        setBatchResults(data.batch_angles);
        handleApplyAngleCopy("hype", data.batch_angles.hype);
        message.success("Batch generated all 3 angles (Hype, Quality, Value) in 1 LLM call! Saved 66% token cost.");
      } else {
        const headline = data.headlines?.[0] || previewData.headline;
        const primaryText = data.primary_texts?.[0] || previewData.primaryText;

        form.setFieldsValue({
          creative_headline: headline,
          creative_primary_text: primaryText,
          creative_cta: data.call_to_action || "SHOP_NOW",
          interests: data.recommended_targeting?.interests || form.getFieldValue("interests"),
        });

        setPreviewData((prev) => ({
          ...prev,
          headline,
          primaryText,
          callToAction: data.call_to_action || "SHOP_NOW",
        }));

        const modelUsed = data.model_used || (premiumRewrite ? "gpt-4o" : "gpt-4o-mini");
        message.success(`Generated copy via ${modelUsed} (${angle.toUpperCase()} angle)!`);
      }

      // Refresh AI status quota
      axios.get(`${API_BASE}/ai/status/`, { headers: { Authorization: `Bearer ${token}` } })
        .then((sRes) => setAiStatus(sRes.data))
        .catch(() => {});

    } catch (err: any) {
      message.error(err?.response?.data?.message || "Failed to generate AI copy.");
    } finally {
      setAiLoading(false);
    }
  };

  const onFinish = async (deployImmediately: boolean = false) => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        ad_account_id: values.ad_account_id,
        name: values.name,
        objective: values.objective || "SALES",
        budget_type: values.budget_type || "DAILY",
        budget_amount: values.budget_amount,
        max_budget_cap: values.max_budget_cap || Number(values.budget_amount) * 3,
        is_first_time_test: values.is_first_time_test ?? true,
        linked_product_id: values.linked_product_id || null,
        targeting: {
          age_min: values.age_range ? values.age_range[0] : 18,
          age_max: values.age_range ? values.age_range[1] : 45,
          genders: values.gender === "all" ? [1, 2] : values.gender === "men" ? [1] : [2],
          countries: ["BD"],
          interests: values.interests || ["Streetwear", "Sneakers"],
          placements: values.placements || ["facebook_feed", "instagram_feed"],
        },
        creative: {
          name: `${values.name} - Main Visual`,
          headline: values.creative_headline,
          primary_text: values.creative_primary_text,
          description: values.creative_description || "STORE.POSHPLEXBD.COM",
          call_to_action: values.creative_cta || "SHOP_NOW",
          image_url: values.creative_image_url || previewData.imageUrl,
        },
      };

      const token = localStorage.getItem("poshplex_access_token");
      const headers = { Authorization: `Bearer ${token}` };

      // Step 1: Create Campaign in local DB
      const res = await axios.post(`${API_BASE}/campaigns/`, payload, { headers });
      const newCampaignId = res.data.id;

      if (deployImmediately) {
        message.loading({ content: "Deploying to Meta Marketing API...", key: "deploy_wizard" });
        await axios.post(`${API_BASE}/campaigns/${newCampaignId}/deploy/`, {}, { headers });
        message.success({ content: "Campaign deployed and active on Meta!", key: "deploy_wizard" });
      } else {
        message.success("Campaign draft saved successfully!");
      }

      navigate(`/marketing/campaigns/${newCampaignId}`);
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Validation failed or server error.");
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { title: "Basics", icon: <RocketOutlined /> },
    { title: "Targeting", icon: <UsergroupAddOutlined /> },
    { title: "Creative & AI", icon: <PictureOutlined /> },
    { title: "Budget & Review", icon: <DollarOutlined /> },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 12px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/marketing/campaigns")}>
            Back
          </Button>
          <Title level={3} style={{ margin: 0, color: "#ffffff" }}>
            New Meta Ads Campaign Wizard
          </Title>
        </Space>
      </div>

      <Steps
        current={currentStep}
        items={steps}
        style={{ marginBottom: 32 }}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          objective: "SALES",
          budget_type: "DAILY",
          budget_amount: 10,
          max_budget_cap: 30,
          is_first_time_test: true,
          gender: "all",
          age_range: [18, 40],
          interests: ["Streetwear", "Sneakers", "Hip hop fashion"],
          placements: ["facebook_feed", "instagram_feed"],
          creative_cta: "SHOP_NOW",
          creative_description: "STORE.POSHPLEXBD.COM",
        }}
      >
        <Row gutter={[24, 24]}>
          {/* Left Form Area */}
          <Col xs={24} lg={14}>
            <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}>
              {/* STEP 1: BASICS */}
              {currentStep === 0 && (
                <div>
                  <Title level={4} style={{ color: "#ffffff", marginBottom: 16 }}>Step 1: Campaign Basics</Title>

                  <Form.Item
                    label="Meta Ad Account"
                    name="ad_account_id"
                    rules={[{ required: true, message: "Please select an ad account" }]}
                  >
                    <Select placeholder="Select Meta Ad Account">
                      {adAccounts.map((acc) => (
                        <Select.Option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.meta_account_id})
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    label="Promoted Catalog Product"
                    name="linked_product_id"
                    help="Select a product from your catalog to automatically pull high-res visuals and pricing"
                  >
                    <Select
                      placeholder="Select product to advertise..."
                      showSearch
                      optionFilterProp="children"
                      onChange={handleProductSelect}
                      allowClear
                    >
                      {products.map((p) => (
                        <Select.Option key={p.id} value={p.id}>
                          {p.name} {p.base_price ? `(BDT ${p.base_price})` : ""}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    label="Campaign Name"
                    name="name"
                    rules={[{ required: true, message: "Campaign name is required" }]}
                  >
                    <Input placeholder="e.g. Acid Wash Hoodie - Fall Launch" />
                  </Form.Item>

                  <Form.Item label="Campaign Objective" name="objective">
                    <Radio.Group style={{ width: "100%" }}>
                      <Row gutter={[12, 12]}>
                        <Col span={12}>
                          <Radio.Button value="SALES" style={{ width: "100%", textAlign: "center" }}>
                            🛍️ Sales / Conversions
                          </Radio.Button>
                        </Col>
                        <Col span={12}>
                          <Radio.Button value="TRAFFIC" style={{ width: "100%", textAlign: "center" }}>
                            🚀 Catalog Traffic
                          </Radio.Button>
                        </Col>
                        <Col span={12}>
                          <Radio.Button value="LEAD" style={{ width: "100%", textAlign: "center" }}>
                            📝 Leads / VIP Signups
                          </Radio.Button>
                        </Col>
                        <Col span={12}>
                          <Radio.Button value="AWARENESS" style={{ width: "100%", textAlign: "center" }}>
                            📢 Brand Reach
                          </Radio.Button>
                        </Col>
                      </Row>
                    </Radio.Group>
                  </Form.Item>

                  <Form.Item
                    label={
                      <Space>
                        <span>New Campaign Safety Mode</span>
                        <Tag color="cyan">Burn Protection</Tag>
                      </Space>
                    }
                    name="is_first_time_test"
                    valuePropName="checked"
                    help="Caps daily budget at max $10 USD for first 24 hours to prevent fat-finger budget burn errors."
                  >
                    <Switch
                      checked={isFirstTimeTest}
                      onChange={(checked) => {
                        setIsFirstTimeTest(checked);
                        form.setFieldsValue({ is_first_time_test: checked });
                        if (checked && form.getFieldValue("budget_amount") > 10) {
                          form.setFieldsValue({ budget_amount: 10 });
                        }
                      }}
                    />
                  </Form.Item>
                </div>
              )}

              {/* STEP 2: TARGETING */}
              {currentStep === 1 && (
                <div>
                  <Title level={4} style={{ color: "#ffffff", marginBottom: 16 }}>Step 2: Audience & Targeting</Title>

                  <Form.Item label="Age Range" name="age_range">
                    <Slider range min={13} max={65} marks={{ 18: "18", 25: "25", 35: "35", 50: "50", 65: "65+" }} />
                  </Form.Item>

                  <Form.Item label="Gender" name="gender">
                    <Radio.Group>
                      <Radio.Button value="all">All Genders</Radio.Button>
                      <Radio.Button value="men">Men</Radio.Button>
                      <Radio.Button value="women">Women</Radio.Button>
                    </Radio.Group>
                  </Form.Item>

                  <Form.Item label="Interests & Hype Keywords" name="interests">
                    <Select
                      mode="tags"
                      placeholder="Type interests (e.g. Streetwear, Sneakers, Hip hop)"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>

                  <div style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, color: "#9ca3af" }}>Suggested Streetwear Tags:</Text>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {["Streetwear", "Sneakers", "Hip hop fashion", "Oversized clothing", "Denim", "Graphic design"].map((tag) => (
                        <Tag
                          key={tag}
                          color="purple"
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            const cur = form.getFieldValue("interests") || [];
                            if (!cur.includes(tag)) form.setFieldsValue({ interests: [...cur, tag] });
                          }}
                        >
                          + {tag}
                        </Tag>
                      ))}
                    </div>
                  </div>

                  <Form.Item label="Placements" name="placements">
                    <Checkbox.Group style={{ width: "100%" }}>
                      <Row gutter={[12, 12]}>
                        <Col span={12}><Checkbox value="facebook_feed">Facebook Feed</Checkbox></Col>
                        <Col span={12}><Checkbox value="instagram_feed">Instagram Feed</Checkbox></Col>
                        <Col span={12}><Checkbox value="instagram_reels">Instagram Reels</Checkbox></Col>
                        <Col span={12}><Checkbox value="facebook_reels">Facebook Reels</Checkbox></Col>
                      </Row>
                    </Checkbox.Group>
                  </Form.Item>
                </div>
              )}

              {/* STEP 3: CREATIVE & AI */}
              {currentStep === 2 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                    <Title level={4} style={{ color: "#ffffff", margin: 0 }}>Step 3: Ad Creative & Copy</Title>
                    <Space wrap>
                      <Button
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        loading={aiLoading}
                        disabled={aiStatus && !aiStatus.is_available}
                        onClick={() => handleGenerateAI("hype", true, false)}
                        style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
                      >
                        ⚡ Batch 3 Angles (1 Call / Save 66%)
                      </Button>
                      <Button
                        type="dashed"
                        icon={<RobotOutlined />}
                        loading={aiLoading}
                        disabled={aiStatus && !aiStatus.is_available}
                        onClick={() => handleGenerateAI("hype", false, false)}
                        style={{ borderColor: "#8b5cf6", color: "#a78bfa" }}
                      >
                        AI Hype Copy (gpt-4o-mini)
                      </Button>
                      <Button
                        type="dashed"
                        icon={<CrownOutlined />}
                        loading={aiLoading}
                        disabled={aiStatus && !aiStatus.is_available}
                        onClick={() => handleGenerateAI(selectedAngleTab, false, true)}
                        style={{ borderColor: "#f59e0b", color: "#fbbf24" }}
                      >
                        ✨ Premium Rewrite (gpt-4o)
                      </Button>
                    </Space>
                  </div>

                  {aiStatus && !aiStatus.is_available && (
                    <Alert
                      type="error"
                      showIcon
                      message="AI Copy Generation Paused"
                      description={`Daily AI budget ceiling ($${aiStatus.daily_budget_usd.toFixed(2)}) reached for today. You can still write or customize copy manually.`}
                      style={{ marginBottom: 16 }}
                    />
                  )}

                  {batchResults && (
                    <Card size="small" style={{ backgroundColor: "rgba(139, 92, 246, 0.08)", borderColor: "rgba(139, 92, 246, 0.25)", marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                        <Text strong style={{ color: "#c4b5fd" }}>Batch Generated Angles (Cached in RAM & Redis):</Text>
                        <Segmented
                          options={[
                            { label: "🔥 Hype / Drop", value: "hype" },
                            { label: "💎 Craft & GSM", value: "craft" },
                            { label: "⚡ Value & COD", value: "value" },
                          ]}
                          value={selectedAngleTab}
                          onChange={(val) => handleApplyAngleCopy(val as string)}
                        />
                      </div>
                      <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                        Clicking an angle instantly loads the copy without making another LLM API call.
                      </Text>
                    </Card>
                  )}

                  <Form.Item
                    label="Media Asset URL (Image or Video)"
                    name="creative_image_url"
                    help="Direct link to image asset on Cloudflare R2 or product media"
                  >
                    <Input
                      placeholder="https://..."
                      onChange={(e) => setPreviewData((prev) => ({ ...prev, imageUrl: e.target.value }))}
                    />
                  </Form.Item>

                  <Form.Item
                    label="Headline"
                    name="creative_headline"
                    rules={[{ required: true, message: "Headline is required" }]}
                  >
                    <Input
                      placeholder="e.g. Heavyweight 240+ GSM Oversized Tee"
                      maxLength={60}
                      onChange={(e) => setPreviewData((prev) => ({ ...prev, headline: e.target.value }))}
                    />
                  </Form.Item>

                  <Form.Item
                    label="Primary Text"
                    name="creative_primary_text"
                    rules={[{ required: true, message: "Primary text is required" }]}
                  >
                    <TextArea
                      rows={4}
                      placeholder="Main streetwear ad copy..."
                      onChange={(e) => setPreviewData((prev) => ({ ...prev, primaryText: e.target.value }))}
                    />
                  </Form.Item>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label="Call to Action (CTA)" name="creative_cta">
                        <Select
                          onChange={(v) => setPreviewData((prev) => ({ ...prev, callToAction: v }))}
                          options={[
                            { label: "Shop Now", value: "SHOP_NOW" },
                            { label: "Order Now", value: "ORDER_NOW" },
                            { label: "Learn More", value: "LEARN_MORE" },
                            { label: "Sign Up", value: "SIGN_UP" },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Display Link Text" name="creative_description">
                        <Input
                          placeholder="STORE.POSHPLEXBD.COM"
                          onChange={(e) => setPreviewData((prev) => ({ ...prev, description: e.target.value }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              )}

              {/* STEP 4: BUDGET & REVIEW */}
              {currentStep === 3 && (
                <div>
                  <Title level={4} style={{ color: "#ffffff", marginBottom: 16 }}>Step 4: Budget & Schedule</Title>

                  <Form.Item label="Budget Type" name="budget_type">
                    <Radio.Group>
                      <Radio.Button value="DAILY">Daily Budget</Radio.Button>
                      <Radio.Button value="LIFETIME">Lifetime Budget</Radio.Button>
                    </Radio.Group>
                  </Form.Item>

                  <Form.Item
                    label="Budget Amount (USD)"
                    name="budget_amount"
                    help={isFirstTimeTest ? "Protected by Safety Limit: Max $10 USD for first-time test campaigns." : "Campaign daily budget amount in USD."}
                    rules={[{ required: true, message: "Budget amount is required and must be greater than 0" }]}
                  >
                    <InputNumber
                      min={1}
                      max={isFirstTimeTest ? 10 : undefined}
                      step={1}
                      prefix="$"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>

                  <Form.Item
                    label={
                      <Space>
                        <span>Max Automated Budget Cap (USD)</span>
                        <Tag color="gold">Ceiling Safety Guard</Tag>
                      </Space>
                    }
                    name="max_budget_cap"
                    help="Autonomous Scaling Rule Ceiling: No automated SCALE_UP action can increase daily budget beyond this amount."
                  >
                    <InputNumber
                      min={10}
                      step={5}
                      prefix="$"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>

                  <Divider style={{ borderColor: "rgba(255,255,255,0.08)" }} />

                  <div style={{ backgroundColor: "rgba(139, 92, 246, 0.08)", padding: 16, borderRadius: 8, border: "1px solid rgba(139, 92, 246, 0.2)" }}>
                    <Text strong style={{ color: "#c4b5fd" }}>Campaign Readiness Summary:</Text>
                    <ul style={{ color: "#e4e4e7", fontSize: 13, paddingLeft: 18, marginTop: 8 }}>
                      <li>Target Audience: Bangladesh (Ages {form.getFieldValue("age_range") ? `${form.getFieldValue("age_range")[0]}-${form.getFieldValue("age_range")[1]}` : "18-45"})</li>
                      <li>Placements: Facebook & Instagram Feeds and Reels</li>
                      <li>Attribution Bridge: Connected to store checkout via UTM parameter engine</li>
                      <li>Autonomous Safety: Protection rules will automatically pause campaign if spend exceeds target without purchases</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Wizard Nav Controls */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                {currentStep > 0 ? (
                  <Button onClick={() => setCurrentStep((prev) => prev - 1)}>Previous</Button>
                ) : <div />}

                <Space>
                  {currentStep < 3 ? (
                    <Button type="primary" onClick={() => setCurrentStep((prev) => prev + 1)} style={{ backgroundColor: "#8b5cf6" }}>
                      Next <ArrowRightOutlined />
                    </Button>
                  ) : (
                    <>
                      <Button
                        icon={<SaveOutlined />}
                        loading={submitting}
                        onClick={() => onFinish(false)}
                      >
                        Save Draft
                      </Button>
                      <Button
                        type="primary"
                        icon={<CloudUploadOutlined />}
                        loading={submitting}
                        onClick={() => onFinish(true)}
                        style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
                      >
                        Deploy to Meta Now
                      </Button>
                    </>
                  )}
                </Space>
              </div>
            </Card>
          </Col>

          {/* Right Column: Interactive Facebook Ad Mockup Preview */}
          <Col xs={24} lg={10}>
            <AdMockupPreview
              headline={previewData.headline}
              primaryText={previewData.primaryText}
              description={previewData.description}
              callToAction={previewData.callToAction}
              imageUrl={previewData.imageUrl}
              productName={previewData.productName}
            />
          </Col>
        </Row>
      </Form>
    </div>
  );
};
