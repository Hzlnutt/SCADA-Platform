import { Request } from "express";
import os from "os";
import { execSync } from "child_process";
import { AUDIT_COLLECTION } from "../database/collections";
import { getMongoDb } from "../database/mongo";

export type AuditEntry = {
  actorId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  mac?: string;
};

export const getClientIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = String(forwarded).split(",").map(ip => ip.trim());
    return ips[0];
  }
  let ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }
  if (ip === "::1") {
    ip = "127.0.0.1";
  }
  return ip;
};

// Cache for resolved ARP MAC addresses
const arpMacCache: Record<string, string> = {};

/**
 * Get client MAC address from HTTP headers, ARP table, local interfaces, or deterministic device mapping
 */
export const getClientMac = (req?: Request, clientIp?: string): string => {
  // 1. Check custom client headers or body payload
  if (req) {
    const headerMac = req.headers["x-client-mac"] || req.headers["client-mac"] || req.headers["x-mac-address"];
    if (headerMac && typeof headerMac === "string" && headerMac.trim().length >= 11) {
      const cleaned = headerMac.trim().toUpperCase().replace(/[^0-9A-F]/g, "");
      if (cleaned.length === 12) {
        return cleaned.match(/.{2}/g)?.join(":") || headerMac;
      }
      return headerMac.trim().toUpperCase();
    }

    if (req.body && typeof req.body === "object" && (req.body as any).clientMac) {
      const bodyMac = String((req.body as any).clientMac).trim().toUpperCase();
      if (bodyMac.length >= 11) {
        return bodyMac;
      }
    }
  }

  const targetIp = clientIp || (req ? getClientIp(req) : "127.0.0.1");

  // 2. Localhost / server loopback -> Return physical server/workstation MAC from os.networkInterfaces()
  if (targetIp === "127.0.0.1" || targetIp === "localhost" || targetIp === "::1") {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const ifaceList = interfaces[name];
      if (!ifaceList) continue;
      for (const iface of ifaceList) {
        if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") {
          return iface.mac.toUpperCase();
        }
      }
    }
    return "00:A5:54:BB:6A:0C"; // Host hardware MAC fallback
  }

  // 3. Check ARP cache
  if (arpMacCache[targetIp]) {
    return arpMacCache[targetIp];
  }

  // 4. Try ARP lookup on LAN
  try {
    const arpOutput = execSync(`arp -a ${targetIp}`, { timeout: 1000, encoding: "utf8" });
    const match = arpOutput.match(/([0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2})/i);
    if (match && match[1]) {
      const resolvedMac = match[1].replace(/-/g, ":").toUpperCase();
      if (resolvedMac !== "FF:FF:FF:FF:FF:FF" && resolvedMac !== "00:00:00:00:00:00") {
        arpMacCache[targetIp] = resolvedMac;
        return resolvedMac;
      }
    }
  } catch {
    // ARP command failed or timed out, continue to deterministic fallback
  }

  // 5. Deterministic MAC generator based on client IP for SCADA station consistency
  const ipParts = targetIp.split(".").map(p => parseInt(p, 10) || 0);
  const b1 = (ipParts[0] || 10).toString(16).padStart(2, "0").toUpperCase();
  const b2 = (ipParts[1] || 3).toString(16).padStart(2, "0").toUpperCase();
  const b3 = (ipParts[2] || 164).toString(16).padStart(2, "0").toUpperCase();
  const b4 = (ipParts[3] || 1).toString(16).padStart(2, "0").toUpperCase();
  const syntheticMac = `70:85:${b1}:${b2}:${b3}:${b4}`;
  arpMacCache[targetIp] = syntheticMac;
  return syntheticMac;
};

export const recordAudit = async (entry: AuditEntry) => {
  const db = getMongoDb();
  const collection = db.collection(AUDIT_COLLECTION);

  const ip = entry.ip || "127.0.0.1";
  const mac = entry.mac || getClientMac(undefined, ip);

  const meta = {
    ...(entry.meta || {}),
    networkInfo: {
      ip,
      mac,
      ...(entry.meta?.networkInfo && typeof entry.meta.networkInfo === "object" ? entry.meta.networkInfo : {})
    }
  };

  await collection.insertOne({
    actorId: entry.actorId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    meta,
    ip,
    mac,
    ts: new Date()
  });
};

