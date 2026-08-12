"use client";

import React, { useState, useEffect } from "react";
import { User, Award, Calendar, Layers } from "lucide-react";

export default function MembershipDirectory() {
  const [members, setMembers] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Load public membership tiers
  const fetchTiers = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/crm/tiers`);
      if (res.ok) {
        const data = await res.json();
        // Only show active public tiers
        setTiers(data.filter((t: any) => t.is_active && t.show_on_public));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load public members
  const fetchMembers = async () => {
    setLoading(true);
    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/crm/public-members`;
      if (selectedTierId) {
        url += `?tier_id=${selectedTierId}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiers();
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [selectedTierId]);

  return (
    <div className="container" style={{ paddingTop: 60, paddingBottom: 100 }}>
      <div style={{ textAlign: "center", marginBottom: 60 }}>
        <h1 style={{ fontSize: 36, fontWeight: 900, color: "var(--text-main)", letterSpacing: "-2px", textTransform: "uppercase" }}>
          Poshplex Members Directory
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15, marginTop: 8 }}>
          Recognizing our active community members, VIPs, and streetwear contributors.
        </p>
      </div>

      {/* Tier Filter Tabs */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 48, flexWrap: "wrap" }}>
        <button
          onClick={() => setSelectedTierId(null)}
          style={{
            padding: "10px 20px",
            background: selectedTierId === null ? "var(--text-main)" : "#ffffff",
            color: selectedTierId === null ? "#ffffff" : "var(--text-main)",
            border: "1px solid var(--border-glass)",
            cursor: "pointer",
            fontWeight: 700,
            textTransform: "uppercase",
            fontSize: 12,
            letterSpacing: "0.5px"
          }}
        >
          All Members
        </button>
        {tiers.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTierId(t.id)}
            style={{
              padding: "10px 20px",
              background: selectedTierId === t.id ? "var(--text-main)" : "#ffffff",
              color: selectedTierId === t.id ? "#ffffff" : "var(--text-main)",
              border: "1px solid var(--border-glass)",
              cursor: "pointer",
              fontWeight: 700,
              textTransform: "uppercase",
              fontSize: 12,
              letterSpacing: "0.5px"
            }}
          >
            {t.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <p style={{ color: "var(--text-muted)" }}>Loading directory records...</p>
        </div>
      ) : members.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, border: "1px dashed var(--border-glass)" }}>
          <p style={{ color: "var(--text-muted)" }}>No members currently listed under this tier.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 32 }}>
          {members.map((member, idx) => (
            <div
              key={idx}
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-glass)",
                padding: 24,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center"
              }}
            >
              {/* Profile Avatar */}
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "var(--bg-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid var(--border-glass)",
                  marginBottom: 16
                }}
              >
                <User size={36} style={{ color: "var(--text-muted)" }} />
              </div>

              <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-main)", marginBottom: 8, textTransform: "uppercase" }}>
                {member.username}
              </h3>

              {/* Tier Badge */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 8px",
                  background: "var(--bg-primary)",
                  border: "1px solid var(--text-main)",
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  marginBottom: 12
                }}
              >
                <Award size={10} /> {member.tier_name}
              </span>

              {/* Join Date option */}
              {member.show_member_since && member.tier_assigned_at && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", marginTop: "auto" }}>
                  <Calendar size={11} /> Member Since: {new Date(member.tier_assigned_at).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
