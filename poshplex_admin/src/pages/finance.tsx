import React, { useState, useEffect, useCallback } from "react";
import {
  Table, Card, Button, Modal, Form, Input,
  InputNumber, Select, Space, Row, Col, Statistic,
  Divider, message, Typography, Tag, Tabs, Alert,
  DatePicker, Descriptions, Badge, Progress, Empty,
  Collapse, List
} from "antd";
import {
  PlusOutlined, WalletOutlined, SwapOutlined,
  BankOutlined, BarChartOutlined, ClockCircleOutlined,
  DollarOutlined, CheckCircleOutlined, LinkOutlined,
  WarningOutlined, ArrowUpOutlined, ArrowDownOutlined,
  ReloadOutlined, EditOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const API = (import.meta.env.VITE_SERVER_URL || 'http://localhost:8000') + "/api/v1/finance";

function authHeaders() {
  const token = localStorage.getItem("poshplex_access_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || JSON.stringify(err));
  }
  return res.json();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SUB-PAGES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ 1. LEDGER (existing) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function LedgerTab() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txEntries, setTxEntries] = useState<any[]>([
    { account_code: "", debit: 0, credit: 0 },
    { account_code: "", debit: 0, credit: 0 }
  ]);
  const [accountForm] = Form.useForm();
  const [txForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accs, sum] = await Promise.all([
        apiFetch("/accounts"),
        apiFetch("/summary")
      ]);
      setAccounts(accs);
      setSummary(sum);
    } catch (e: any) { if (e?.response?.status !== 403) message.error(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleCreateAccount = async (vals: any) => {
    try {
      await apiFetch("/accounts", { method: "POST", body: JSON.stringify(vals) });
      message.success("Account created.");
      setIsAccountModalOpen(false); accountForm.resetFields(); load();
    } catch (e: any) { if (e?.response?.status !== 403) message.error(e.message); }
  };

  const handlePostTx = async (vals: any) => {
    const totalDebit = txEntries.reduce((s, e) => s + Number(e.debit || 0), 0);
    const totalCredit = txEntries.reduce((s, e) => s + Number(e.credit || 0), 0);
    if (totalDebit <= 0) { message.error("Debit must be > 0"); return; }
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      message.error(`Unbalanced! DR: ${totalDebit.toFixed(2)}, CR: ${totalCredit.toFixed(2)}`); return;
    }
    try {
      await apiFetch("/transactions", { method: "POST", body: JSON.stringify({ ...vals, entries: txEntries }) });
      message.success("Transaction posted to ledger.");
      setIsTxModalOpen(false); txForm.resetFields();
      setTxEntries([{ account_code: "", debit: 0, credit: 0 }, { account_code: "", debit: 0, credit: 0 }]);
      load();
    } catch (e: any) { if (e?.response?.status !== 403) message.error(e.message); }
  };

  const updateEntry = (i: number, f: string, v: any) => {
    const u = [...txEntries]; u[i][f] = v; setTxEntries(u);
  };

  const cols = [
    { title: "Code", dataIndex: "code", key: "code", render: (c: string) => <code style={{ color: "#e11d48" }}>{c}</code> },
    { title: "Account Name", dataIndex: "name", key: "name", render: (t: string) => <b>{t}</b> },
    { title: "Type", dataIndex: "type", key: "type", render: (t: string) => <Tag color="blue">{t.toUpperCase()}</Tag> },
    { title: "Group", dataIndex: "pl_group", key: "pl_group", render: (g: string) => <Tag>{g.replace("_", " ").toUpperCase()}</Tag> },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        {[
          { label: "Assets", val: summary.asset, color: "#10b981" },
          { label: "Liabilities", val: summary.liability, color: "#e11d48" },
          { label: "Equity", val: summary.equity, color: "#8b5cf6" },
          { label: "Revenue", val: summary.revenue, color: "#3b82f6" },
          { label: "Expenses", val: summary.expense, color: "#f59e0b" },
          { label: "Net P&L", val: summary.net_income, color: Number(summary.net_income || 0) >= 0 ? "#10b981" : "#e11d48" },
        ].map(({ label, val, color }) => (
          <Col xs={12} sm={8} md={4} key={label}>
            <Card size="small">
              <Statistic title={label} value={Number(val || 0)} precision={2} prefix="৳" valueStyle={{ color, fontSize: 18 }} />
            </Card>
          </Col>
        ))}
      </Row>
      <Card
        title="Chart of Accounts"
        extra={
          <Space>
            <Button icon={<PlusOutlined />} onClick={() => setIsAccountModalOpen(true)}>New Account</Button>
            <Button type="primary" icon={<SwapOutlined />} onClick={() => setIsTxModalOpen(true)}>Post Journal Entry</Button>
          </Space>
        }
      >
        <Table dataSource={accounts} columns={cols} rowKey="id" loading={loading} scroll={{ x: "max-content" }} />
      </Card>

      <Modal title="Create Ledger Account" open={isAccountModalOpen} onCancel={() => setIsAccountModalOpen(false)} onOk={() => accountForm.submit()}>
        <Form form={accountForm} onFinish={handleCreateAccount} layout="vertical">
          <Form.Item name="name" label="Account Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="Account Code" rules={[{ required: true }]}><Input placeholder="e.g. 1010-PETTY" /></Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={["asset","liability","equity","revenue","expense"].map(v => ({ value: v, label: v.toUpperCase() }))} />
          </Form.Item>
          <Form.Item name="pl_group" label="Statement Group" rules={[{ required: true }]}>
            <Select options={[{ value: "balance_sheet", label: "Balance Sheet" }, { value: "income_statement", label: "Income Statement / P&L" }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Post Journal Entry" open={isTxModalOpen} onCancel={() => setIsTxModalOpen(false)} onOk={() => txForm.submit()} width="min(700px, 96vw)">
        <Form form={txForm} onFinish={handlePostTx} layout="vertical">
          <Row gutter={16}>
            <Col span={14}><Form.Item name="description" label="Description" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={10}><Form.Item name="reference_id" label="Reference ID"><Input placeholder="ORDER-123" /></Form.Item></Col>
          </Row>
          <Divider>Entry Lines</Divider>
          {txEntries.map((e, i) => (
            <Row gutter={8} key={i} style={{ marginBottom: 8 }}>
              <Col span={10}>
                <Select placeholder="Account" value={e.account_code || undefined} onChange={v => updateEntry(i, "account_code", v)} style={{ width: "100%" }}>
                  {accounts.map((a: any) => <Select.Option key={a.code} value={a.code}>{a.code} - {a.name}</Select.Option>)}
                </Select>
              </Col>
              <Col span={6}><InputNumber placeholder="Debit" value={e.debit} min={0} onChange={v => updateEntry(i, "debit", v || 0)} style={{ width: "100%" }} /></Col>
              <Col span={6}><InputNumber placeholder="Credit" value={e.credit} min={0} onChange={v => updateEntry(i, "credit", v || 0)} style={{ width: "100%" }} /></Col>
              <Col span={2}><Button danger type="text" onClick={() => setTxEntries(txEntries.filter((_, idx) => idx !== i))}>âœ•</Button></Col>
            </Row>
          ))}
          <Button type="dashed" onClick={() => setTxEntries([...txEntries, { account_code: "", debit: 0, credit: 0 }])} block icon={<PlusOutlined />} style={{ marginTop: 8 }}>Add Row</Button>
        </Form>
      </Modal>
    </Space>
  );
}

// â”€â”€ 2. BALANCE SHEET â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BalanceSheetTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [asOf, setAsOf] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const q = asOf ? `?as_of=${asOf}` : "";
      const d = await apiFetch(`/balance-sheet${q}`);
      setData(d);
    } catch (e: any) { if (e?.response?.status !== 403) message.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const lineTable = (lines: any[]) => (
    <Table
      dataSource={lines}
      rowKey="code"
      size="small"
      pagination={false}
      columns={[
        { title: "Code", dataIndex: "code", render: (c: string) => <code style={{ color: "#e11d48" }}>{c}</code> },
        { title: "Account", dataIndex: "name" },
        { title: "Balance (৳)", dataIndex: "balance", align: "right" as const, render: (v: number) => <b>{Number(v).toFixed(2)}</b> },
      ]}
    />
  );

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card>
        <Space>
          <DatePicker placeholder="As of date (default: today)" onChange={(_, s) => setAsOf(s as string)} />
          <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={load}>Generate Report</Button>
        </Space>
      </Card>

      {data && (
        <>
          <Alert
            type={data.is_balanced ? "success" : "error"}
            message={data.is_balanced ? `âœ… Balance Sheet is balanced as of ${data.as_of_date}` : "âš ï¸ Balance Sheet is NOT balanced â€” check your entries."}
            showIcon
          />
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title={<><ArrowUpOutlined style={{ color: "#10b981" }} /> Assets</>} extra={<b style={{ color: "#10b981" }}>৳ {Number(data.assets.total).toFixed(2)}</b>}>
                {lineTable(data.assets.lines)}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title={<><ArrowDownOutlined style={{ color: "#e11d48" }} /> Liabilities</>} extra={<b style={{ color: "#e11d48" }}>৳ {Number(data.liabilities.total).toFixed(2)}</b>}>
                {lineTable(data.liabilities.lines)}
              </Card>
            </Col>
            <Col xs={24}>
              <Card
                title={<><WalletOutlined style={{ color: "#8b5cf6" }} /> Equity (incl. Retained Earnings)</>}
                extra={<b style={{ color: "#8b5cf6" }}>৳ {Number(data.equity.total).toFixed(2)}</b>}
              >
                {lineTable(data.equity.lines)}
                <Divider />
                <Row justify="space-between" style={{ padding: "0 8px" }}>
                  <Text>Retained Earnings (Net Income)</Text>
                  <b>৳ {Number(data.equity.retained_earnings).toFixed(2)}</b>
                </Row>
              </Card>
            </Col>
            <Col xs={24}>
              <Card>
                <Row justify="space-between" align="middle">
                  <Title level={4} style={{ margin: 0 }}>Total Liabilities + Equity</Title>
                  <Title level={3} style={{ margin: 0, color: data.is_balanced ? "#10b981" : "#e11d48" }}>
                    ৳ {Number(data.total_liabilities_and_equity).toFixed(2)}
                  </Title>
                </Row>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Space>
  );
}

// â”€â”€ 3. AR AGING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ARAgingTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setData(await apiFetch("/ar-aging")); }
    catch (e: any) { if (e?.response?.status !== 403) message.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const rowCols = [
    { title: "Order #", dataIndex: "order_number", render: (v: string) => <b>{v}</b> },
    { title: "Customer", dataIndex: "customer" },
    { title: "Order Date", dataIndex: "order_date" },
    { title: "Age (days)", dataIndex: "age_days", render: (v: number) => <Tag color={v <= 30 ? "green" : v <= 60 ? "orange" : "red"}>{v}d</Tag> },
    { title: "Total (৳)", dataIndex: "total_amount", align: "right" as const, render: (v: number) => Number(v).toFixed(2) },
    { title: "Paid (৳)", dataIndex: "paid_amount", align: "right" as const, render: (v: number) => Number(v).toFixed(2) },
    { title: "Outstanding (৳)", dataIndex: "outstanding", align: "right" as const, render: (v: number) => <b style={{ color: "#e11d48" }}>{Number(v).toFixed(2)}</b> },
  ];

  const buckets = data ? [
    { label: "Current (0â€“30 days)", key: "current_0_30", color: "#10b981", total: data.totals.current_0_30 },
    { label: "31â€“60 days", key: "days_31_60", color: "#f59e0b", total: data.totals.days_31_60 },
    { label: "61â€“90 days", key: "days_61_90", color: "#f97316", total: data.totals.days_61_90 },
    { label: "91+ days (Overdue)", key: "days_91_plus", color: "#e11d48", total: data.totals.days_91_plus },
  ] : [];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card extra={<Button icon={<ReloadOutlined />} loading={loading} onClick={load}>Refresh</Button>}>
        {data && (
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <Statistic title="Open Orders" value={data.summary.total_open_orders} prefix={<ClockCircleOutlined />} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Total Outstanding" value={Number(data.summary.total_outstanding)} precision={2} prefix="৳" valueStyle={{ color: "#e11d48" }} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Report Date" value={data.as_of_date} />
            </Col>
          </Row>
        )}
      </Card>

      {data && (
        <Collapse
          defaultActiveKey={["current_0_30"]}
          items={buckets.map(({ label, key, color, total }) => ({
            key,
            label: (
              <Space>
                <b style={{ color }}>{label}</b>
                <Tag color={color}>৳ {Number(total).toFixed(2)}</Tag>
                <Tag>{data.buckets[key].length} orders</Tag>
              </Space>
            ),
            children: data.buckets[key].length > 0
              ? <Table dataSource={data.buckets[key]} columns={rowCols} rowKey="order_number" size="small" pagination={false} />
              : <Empty description="No outstanding orders in this bucket" />
          }))}
        />
      )}
    </Space>
  );
}

// â”€â”€ 4. CASH FLOW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CashFlowTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const start = dates?.[0] ? dayjs(dates[0]).format("YYYY-MM-DD") : "";
      const end = dates?.[1] ? dayjs(dates[1]).format("YYYY-MM-DD") : "";
      const q = start && end ? `?start_date=${start}&end_date=${end}` : "";
      setData(await apiFetch(`/cash-flow${q}`));
    } catch (e: any) { if (e?.response?.status !== 403) message.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const lineTable = (lines: any[], isOutflow = false) => (
    <Table
      dataSource={lines}
      rowKey="code"
      size="small"
      pagination={false}
      columns={[
        { title: "Code", dataIndex: "code", render: (c: string) => <code style={{ color: "#e11d48" }}>{c}</code> },
        { title: "Account", dataIndex: "account" },
        { title: "Amount (৳)", dataIndex: "amount", align: "right" as const, render: (v: number) => <span style={{ color: isOutflow ? "#e11d48" : "#10b981" }}>{isOutflow ? "-" : "+"}{Number(v).toFixed(2)}</span> },
      ]}
    />
  );

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card>
        <Space wrap>
          <DatePicker.RangePicker onChange={setDates} />
          <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={load}>Generate</Button>
        </Space>
      </Card>

      {data && (
        <>
          <Row gutter={[16, 16]}>
            {[
              { label: "Operating Cash", val: data.operating.net, icon: <DollarOutlined /> },
              { label: "Investing Cash", val: data.investing.net, icon: <BarChartOutlined /> },
              { label: "Financing Cash", val: data.financing.net, icon: <BankOutlined /> },
              { label: "Net Cash Change", val: data.net_cash_change, icon: <SwapOutlined /> },
            ].map(({ label, val, icon }) => (
              <Col xs={12} md={6} key={label}>
                <Card size="small">
                  <Statistic
                    title={label} value={Number(val).toFixed(2)} prefix={<>৳ {icon}</>}
                    valueStyle={{ color: Number(val) >= 0 ? "#10b981" : "#e11d48", fontSize: 18 }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          <Card title={<><DollarOutlined /> Operating Activities ({data.period_start} â†’ {data.period_end})</>}>
            <b style={{ color: "#10b981" }}>Inflows</b>
            {lineTable(data.operating.inflows)}
            <Divider />
            <b style={{ color: "#e11d48" }}>Outflows</b>
            {lineTable(data.operating.outflows, true)}
            <Divider />
            <Row justify="space-between"><Text>Net Operating Cash Flow</Text><b style={{ color: Number(data.operating.net) >= 0 ? "#10b981" : "#e11d48" }}>৳ {Number(data.operating.net).toFixed(2)}</b></Row>
          </Card>

          <Card title={<><BarChartOutlined /> Investing Activities</>}>
            {data.investing.lines.length > 0 ? lineTable(data.investing.lines) : <Empty description="No investing activities in this period" />}
            <Divider />
            <Row justify="space-between"><Text>Net Investing Cash Flow</Text><b>৳ {Number(data.investing.net).toFixed(2)}</b></Row>
          </Card>

          <Card title={<><BankOutlined /> Financing Activities</>}>
            {data.financing.lines.length > 0 ? lineTable(data.financing.lines) : <Empty description="No financing activities in this period" />}
            <Divider />
            <Row justify="space-between"><Text>Net Financing Cash Flow</Text><b>৳ {Number(data.financing.net).toFixed(2)}</b></Row>
          </Card>

          <Card>
            <Row justify="space-between" align="middle">
              <Title level={4} style={{ margin: 0 }}>Net Change in Cash</Title>
              <Title level={3} style={{ margin: 0, color: Number(data.net_cash_change) >= 0 ? "#10b981" : "#e11d48" }}>
                ৳ {Number(data.net_cash_change).toFixed(2)}
              </Title>
            </Row>
          </Card>
        </>
      )}
    </Space>
  );
}

// â”€â”€ 5. BANK RECONCILIATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BankReconciliationTab() {
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [statements, setStatements] = useState<any[]>([]);
  const [selectedStatement, setSelectedStatement] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [reconStatus, setReconStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Modals
  const [bankModal, setBankModal] = useState(false);
  const [editBankModal, setEditBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState<any>(null);
  const [statementModal, setStatementModal] = useState(false);
  const [txModal, setTxModal] = useState(false);
  const [reconModal, setReconModal] = useState(false);
  const [selectedBankTx, setSelectedBankTx] = useState<any>(null);
  const [ledgerEntryId, setLedgerEntryId] = useState<string>("");

  const [bankForm] = Form.useForm();
  const [editBankForm] = Form.useForm();
  const [statementForm] = Form.useForm();
  const [txForm] = Form.useForm();
  const [ledgerAccounts, setLedgerAccounts] = useState<any[]>([]);

  const loadBankAccounts = async () => {
    setLoading(true);
    try {
      const [accs, ledger] = await Promise.all([
        apiFetch("/bank-accounts"),
        apiFetch("/accounts")
      ]);
      setBankAccounts(accs);
      setLedgerAccounts(ledger);
    } catch (e: any) { if (e?.response?.status !== 403) message.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadBankAccounts(); }, []);

  const selectBank = async (ba: any) => {
    setSelectedBank(ba);
    setSelectedStatement(null);
    setTransactions([]);
    try {
      const [stmts, status] = await Promise.all([
        apiFetch(`/bank-accounts/${ba.id}/statements`),
        apiFetch(`/bank-accounts/${ba.id}/reconciliation-status`)
      ]);
      setStatements(stmts);
      setReconStatus(status);
    } catch (e: any) { if (e?.response?.status !== 403) message.error(e.message); }
  };

  const selectStatement = async (stmt: any) => {
    setSelectedStatement(stmt);
    try {
      const txs = await apiFetch(`/bank-accounts/${selectedBank.id}/statements/${stmt.id}/transactions`);
      setTransactions(txs);
    } catch (e: any) { if (e?.response?.status !== 403) message.error(e.message); }
  };

  const handleCreateBank = async (vals: any) => {
    try {
      await apiFetch("/bank-accounts", { method: "POST", body: JSON.stringify(vals) });
      message.success("Bank account registered.");
      setBankModal(false); bankForm.resetFields(); loadBankAccounts();
    } catch (e: any) { if (e?.response?.status !== 403) message.error(e.message); }
  };

  const handleUpdateBank = async (vals: any) => {
    if (!editingBank) return;
    try {
      await apiFetch(`/bank-accounts/${editingBank.id}`, { method: "PUT", body: JSON.stringify(vals) });
      message.success("Bank account updated.");
      setEditBankModal(false); editBankForm.resetFields(); setEditingBank(null); loadBankAccounts();
    } catch (e: any) { if (e?.response?.status !== 403) message.error(e.message); }
  };

  const handleCreateStatement = async (vals: any) => {
    try {
      const payload = {
        ...vals,
        period_start: dayjs(vals.period_start).format("YYYY-MM-DD"),
        period_end: dayjs(vals.period_end).format("YYYY-MM-DD"),
      };
      await apiFetch(`/bank-accounts/${selectedBank.id}/statements`, { method: "POST", body: JSON.stringify(payload) });
      message.success("Statement period created.");
      setStatementModal(false); statementForm.resetFields(); selectBank(selectedBank);
    } catch (e: any) { if (e?.response?.status !== 403) message.error(e.message); }
  };

  const handleAddTx = async (vals: any) => {
    try {
      const payload = {
        transactions: [{
          ...vals,
          transaction_date: dayjs(vals.transaction_date).format("YYYY-MM-DD"),
        }]
      };
      await apiFetch(`/bank-accounts/${selectedBank.id}/statements/${selectedStatement.id}/transactions/bulk`,
        { method: "POST", body: JSON.stringify(payload) });
      message.success("Transaction added.");
      setTxModal(false); txForm.resetFields(); selectStatement(selectedStatement);
    } catch (e: any) { if (e?.response?.status !== 403) message.error(e.message); }
  };

  const handleReconcile = async () => {
    if (!ledgerEntryId) { message.error("Enter a ledger entry ID."); return; }
    try {
      await apiFetch("/reconcile", {
        method: "POST",
        body: JSON.stringify({ bank_transaction_id: selectedBankTx.id, ledger_entry_id: parseInt(ledgerEntryId) })
      });
      message.success("Reconciled successfully.");
      setReconModal(false); setLedgerEntryId("");
      selectStatement(selectedStatement);
      selectBank(selectedBank);
    } catch (e: any) { if (e?.response?.status !== 403) message.error(e.message); }
  };

  const PROVIDERS = [
    { value: "bkash", label: "bKash" },
    { value: "nagad", label: "Nagad" },
    { value: "rocket", label: "Rocket" },
    { value: "upay", label: "Upay" },
    { value: "dbbl", label: "Dutch-Bangla Bank (DBBL)" },
    { value: "brac_bank", label: "BRAC Bank" },
    { value: "islami_bank", label: "Islami Bank" },
    { value: "city_bank", label: "City Bank" },
    { value: "eastern_bank", label: "Eastern Bank" },
    { value: "ucb", label: "UCB" },
    { value: "prime_bank", label: "Prime Bank" },
    { value: "trust_bank", label: "Trust Bank" },
    { value: "other", label: "Other" },
  ];

  const txCols = [
    { title: "Date", dataIndex: "transaction_date" },
    { title: "Description", dataIndex: "description" },
    { title: "Type", dataIndex: "transaction_type", render: (t: string) => <Tag color={t === "credit" ? "green" : "red"}>{t === "credit" ? "â†‘ IN" : "â†“ OUT"}</Tag> },
    { title: "Amount (৳)", dataIndex: "amount", align: "right" as const, render: (v: number) => <b>{Number(v).toFixed(2)}</b> },
    { title: "Reference", dataIndex: "reference", render: (v: string) => v || "â€”" },
    { title: "Status", dataIndex: "is_reconciled", render: (v: boolean) => v ? <Badge status="success" text="Reconciled" /> : <Badge status="warning" text="Pending" /> },
    {
      title: "Action", key: "action", render: (_: any, row: any) => !row.is_reconciled ? (
        <Button size="small" type="primary" icon={<LinkOutlined />} onClick={() => { setSelectedBankTx(row); setReconModal(true); }}>Match</Button>
      ) : <CheckCircleOutlined style={{ color: "#10b981" }} />
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Row gutter={[16, 0]} align="middle">
        <Col flex="auto"><Title level={4} style={{ margin: 0 }}>Bank & Mobile Banking Accounts</Title></Col>
        <Col><Button type="primary" icon={<PlusOutlined />} onClick={() => setBankModal(true)}>Add Account</Button></Col>
      </Row>

      <Row gutter={[16, 16]}>
        {bankAccounts.map(ba => (
          <Col xs={24} sm={12} md={8} key={ba.id}>
            <Card
              hoverable
              style={{ borderColor: selectedBank?.id === ba.id ? "#e11d48" : undefined }}
              onClick={() => selectBank(ba)}
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <Row justify="space-between" align="middle">
                  <Text strong>{ba.name}</Text>
                  <Space>
                    <Tag color="blue">{ba.provider.toUpperCase()}</Tag>
                    <Button 
                      size="small" 
                      type="text" 
                      icon={<EditOutlined />} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingBank(ba);
                        editBankForm.setFieldsValue({
                          name: ba.name,
                          account_type: ba.account_type,
                          provider: ba.provider,
                          account_number: ba.account_number,
                          notes: ba.notes
                        });
                        setEditBankModal(true);
                      }} 
                    />
                  </Space>
                </Row>
                <Text type="secondary" style={{ fontSize: 12 }}>{ba.account_number}</Text>
                <Text style={{ fontSize: 12 }}>Ledger: <code style={{ color: "#e11d48" }}>{ba.ledger_account_code}</code></Text>
                <Text style={{ fontSize: 12 }}>Opening: ৳{Number(ba.opening_balance).toFixed(2)}</Text>
              </Space>
            </Card>
          </Col>
        ))}
        {bankAccounts.length === 0 && <Col span={24}><Empty description="No bank accounts registered yet. Click 'Add Account' to start." /></Col>}
      </Row>

      {selectedBank && reconStatus && (
        <Card title={`Reconciliation Status â€” ${selectedBank.name}`}>
          <Row gutter={[16, 16]}>
            <Col xs={8}><Statistic title="Total Transactions" value={reconStatus.total} /></Col>
            <Col xs={8}><Statistic title="Reconciled" value={reconStatus.reconciled} valueStyle={{ color: "#10b981" }} /></Col>
            <Col xs={8}><Statistic title="Unreconciled" value={reconStatus.unreconciled} valueStyle={{ color: "#e11d48" }} /></Col>
            <Col xs={24}>
              <Progress
                percent={reconStatus.total > 0 ? Math.round((reconStatus.reconciled / reconStatus.total) * 100) : 0}
                strokeColor="#10b981"
                trailColor="#e11d48"
              />
            </Col>
          </Row>
        </Card>
      )}

      {selectedBank && (
        <Card
          title={`Statements â€” ${selectedBank.name}`}
          extra={<Button icon={<PlusOutlined />} onClick={() => setStatementModal(true)}>Add Statement Period</Button>}
        >
          <List
            dataSource={statements}
            renderItem={(s: any) => (
              <List.Item
                onClick={() => selectStatement(s)}
                style={{ cursor: "pointer", background: selectedStatement?.id === s.id ? "rgba(225,29,72,0.05)" : undefined, padding: 12 }}
                actions={[
                  <Tag color="green">{s.reconciled_count} reconciled</Tag>,
                  <Tag color="orange">{s.unreconciled_count} pending</Tag>
                ]}
              >
                <List.Item.Meta
                  title={`${s.period_start} â†’ ${s.period_end}`}
                  description={`Opening: ৳${Number(s.opening_balance).toFixed(2)} | Closing: ৳${Number(s.closing_balance).toFixed(2)} | ${s.total_transactions} transactions`}
                />
              </List.Item>
            )}
            locale={{ emptyText: "No statements yet." }}
          />
        </Card>
      )}

      {selectedStatement && (
        <Card
          title={`Transactions â€” ${selectedStatement.period_start} â†’ ${selectedStatement.period_end}`}
          extra={<Button icon={<PlusOutlined />} onClick={() => setTxModal(true)}>Add Transaction</Button>}
        >
          <Table dataSource={transactions} columns={txCols} rowKey="id" size="small" scroll={{ x: "max-content" }} />
        </Card>
      )}

      {/* Add Bank Modal */}
      <Modal title="Register Bank / Mobile Banking Account" open={bankModal} onCancel={() => setBankModal(false)} onOk={() => bankForm.submit()}>
        <Form form={bankForm} onFinish={handleCreateBank} layout="vertical">
          <Form.Item name="name" label="Account Label" rules={[{ required: true }]}><Input placeholder="e.g. bKash Business #1" /></Form.Item>
          <Form.Item name="account_type" label="Account Type" rules={[{ required: true }]}>
            <Select options={[{ value: "bank", label: "Bank Account" }, { value: "mobile_banking", label: "Mobile Banking" }, { value: "cash", label: "Cash in Hand" }]} />
          </Form.Item>
          <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
            <Select options={PROVIDERS} />
          </Form.Item>
          <Form.Item name="account_number" label="Account / Mobile Number" rules={[{ required: true }]}><Input placeholder="01XXXXXXXXX or 1234-5678" /></Form.Item>
          <Form.Item name="ledger_account_code" label="Linked Ledger Account" rules={[{ required: true }]} help="Must be an existing ledger account from your Chart of Accounts">
            <Select placeholder="Select ledger account">
              {ledgerAccounts.map((a: any) => (
                <Select.Option key={a.code} value={a.code}>{a.code} - {a.name} ({a.type.toUpperCase()})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="opening_balance" label="Opening Balance (৳)"><InputNumber min={0} style={{ width: "100%" }} defaultValue={0} /></Form.Item>
          <Form.Item name="notes" label="Payment Instructions (Notes)" help="This text will be shown to customers on the checkout page when they select this payment method."><Input.TextArea rows={2} placeholder="e.g. Please send money to 017XXXXXX and use your Order ID as reference." /></Form.Item>
        </Form>
      </Modal>

      {/* Edit Bank Modal */}
      <Modal title="Edit Bank / Mobile Banking Account" open={editBankModal} onCancel={() => { setEditBankModal(false); setEditingBank(null); }} onOk={() => editBankForm.submit()}>
        <Form form={editBankForm} onFinish={handleUpdateBank} layout="vertical">
          <Form.Item name="name" label="Account Label" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="account_type" label="Account Type" rules={[{ required: true }]}>
            <Select options={[{ value: "bank", label: "Bank Account" }, { value: "mobile_banking", label: "Mobile Banking" }, { value: "cash", label: "Cash in Hand" }]} />
          </Form.Item>
          <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
            <Select options={PROVIDERS} />
          </Form.Item>
          <Form.Item name="account_number" label="Account / Mobile Number" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="notes" label="Payment Instructions (Notes)" help="This text will be shown to customers on the checkout page when they select this payment method."><Input.TextArea rows={3} placeholder="e.g. Please send money to 017XXXXXX and use your Order ID as reference." /></Form.Item>
        </Form>
      </Modal>

      {/* Add Statement Modal */}
      <Modal title="Add Statement Period" open={statementModal} onCancel={() => setStatementModal(false)} onOk={() => statementForm.submit()}>
        <Form form={statementForm} onFinish={handleCreateStatement} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="period_start" label="Period Start" rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="period_end" label="Period End" rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="opening_balance" label="Opening Balance (৳)" rules={[{ required: true }]}><InputNumber style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="closing_balance" label="Closing Balance (৳)" rules={[{ required: true }]}><InputNumber style={{ width: "100%" }} /></Form.Item></Col>
          </Row>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* Add Transaction Modal */}
      <Modal title="Add Statement Transaction" open={txModal} onCancel={() => setTxModal(false)} onOk={() => txForm.submit()}>
        <Form form={txForm} onFinish={handleAddTx} layout="vertical">
          <Form.Item name="transaction_date" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="transaction_type" label="Type" rules={[{ required: true }]}>
            <Select options={[{ value: "credit", label: "â†‘ Credit (Money In)" }, { value: "debit", label: "â†“ Debit (Money Out)" }]} />
          </Form.Item>
          <Form.Item name="amount" label="Amount (৳)" rules={[{ required: true }]}><InputNumber min={0.01} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="reference" label="Reference (TrxID / Cheque No.)"><Input placeholder="e.g. bKash TrxID or Cheque 001" /></Form.Item>
        </Form>
      </Modal>

      {/* Reconcile Modal */}
      <Modal title="Match to Ledger Entry" open={reconModal} onCancel={() => setReconModal(false)} onOk={handleReconcile} okText="Confirm Match">
        {selectedBankTx && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Alert
              type="info"
              message={`Bank Transaction: ${selectedBankTx.transaction_type === "credit" ? "â†‘" : "â†“"} ৳${Number(selectedBankTx.amount).toFixed(2)} â€” ${selectedBankTx.description}`}
            />
            <Form layout="vertical">
              <Form.Item label="Ledger Entry ID" help="Enter the ledger Entry ID to match against this bank transaction">
                <InputNumber
                  style={{ width: "100%" }}
                  placeholder="e.g. 42"
                  value={parseInt(ledgerEntryId) || undefined}
                  onChange={(v) => setLedgerEntryId(String(v || ""))}
                />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Modal>
    </Space>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MAIN PAGE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const Finance: React.FC = () => {
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Financial Ledger System</h1>
        <p style={{ margin: 0, color: "#888", fontSize: 14 }}>
          Double-entry ledger Â· Balance Sheet Â· AR Aging Â· Cash Flow Â· Bank Reconciliation
        </p>
      </div>

      <Tabs
        defaultActiveKey="ledger"
        size="large"
        items={[
          { key: "ledger", label: <><WalletOutlined /> Ledger & Accounts</>, children: <LedgerTab /> },
          { key: "balance-sheet", label: <><BarChartOutlined /> Balance Sheet</>, children: <BalanceSheetTab /> },
          { key: "ar-aging", label: <><ClockCircleOutlined /> AR Aging</>, children: <ARAgingTab /> },
          { key: "cash-flow", label: <><DollarOutlined /> Cash Flow</>, children: <CashFlowTab /> },
          { key: "bank-recon", label: <><BankOutlined /> Bank Reconciliation</>, children: <BankReconciliationTab /> },
        ]}
      />
    </Space>
  );
};

export default Finance;




