import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowDownTrayIcon,
  ArrowRightStartOnRectangleIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  SwatchIcon,
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  TagIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { api } from "../api";
import { useAuth } from "../auth";
import LabelManager from "../components/LabelManager";
import IcsSettings from "../components/IcsSettings";
import PhotoUsage from "../components/PhotoUsage";
import TelegramSettings from "../components/TelegramSettings";
import ThemePicker from "../components/ThemePicker";

function Card({ icon: Icon, title, children, danger }) {
  return (
    <section
      className={`rounded-2xl bg-surface p-5 shadow-sm ring-1 ${danger ? "ring-red-200" : "ring-stone-200"}`}
    >
      <h2 className={`mb-3 flex items-center gap-2 font-serif text-lg font-semibold ${danger ? "text-red-700" : ""}`}>
        <Icon className="size-5" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-stone-600">{label}</span>
      <input className="input" {...props} />
    </label>
  );
}

const Msg = ({ msg }) =>
  msg ? <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p> : null;

export default function Settings() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();

  const onAuthError = (err, set) => (err.status === 401 && !err.message.includes("incorrect") ? setUser(null) : set({ ok: false, text: thaiError(err.message) }));

  // change password
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);
  async function changePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.next !== pw.confirm) return setPwMsg({ ok: false, text: "รหัสผ่านใหม่สองช่องไม่ตรงกัน" });
    setPwBusy(true);
    try {
      const d = await api("/auth/password", {
        method: "PUT",
        body: { currentPassword: pw.current, newPassword: pw.next },
      });
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg({
        ok: true,
        text: d.loggedOut ? `เปลี่ยนรหัสผ่านแล้ว และออกจากระบบอุปกรณ์อื่น ${d.loggedOut} เครื่อง` : "เปลี่ยนรหัสผ่านแล้ว",
      });
    } catch (err) {
      onAuthError(err, setPwMsg);
    } finally {
      setPwBusy(false);
    }
  }

  // log out other devices
  const [othersMsg, setOthersMsg] = useState(null);
  async function logoutOthers() {
    setOthersMsg(null);
    try {
      const d = await api("/auth/logout-others", { method: "POST" });
      setOthersMsg({ ok: true, text: d.loggedOut ? `ออกจากระบบแล้ว ${d.loggedOut} เครื่อง` : "ไม่มีอุปกรณ์อื่นที่ login อยู่" });
    } catch (err) {
      onAuthError(err, setOthersMsg);
    }
  }

  // delete account
  const [del, setDel] = useState({ username: "", password: "" });
  const [delMsg, setDelMsg] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const canDelete = del.username === user.username && del.password.length > 0;
  async function deleteAccount(e) {
    e.preventDefault();
    if (!canDelete) return;
    setDelBusy(true);
    setDelMsg(null);
    try {
      await api("/auth/account", { method: "DELETE", body: { password: del.password } });
      setUser(null);
      navigate("/login", { replace: true });
    } catch (err) {
      onAuthError(err, setDelMsg);
      setDelBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card icon={UserCircleIcon} title="บัญชี">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            <span className="text-sm text-stone-500">ชื่อผู้ใช้</span>{" "}
            <span className="font-medium">{user.username}</span>
          </p>
          <button className="btn btn-ghost" onClick={logout}>
            <ArrowRightStartOnRectangleIcon className="size-4" aria-hidden="true" />
            ออกจากระบบ
          </button>
        </div>
      </Card>

      <Card icon={KeyIcon} title="เปลี่ยนรหัสผ่าน">
        <form onSubmit={changePassword} className="space-y-3">
          <Field
            label="รหัสผ่านปัจจุบัน"
            type="password"
            autoComplete="current-password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="รหัสผ่านใหม่ (8 ตัวขึ้นไป)"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              required
            />
            <Field
              label="ยืนยันรหัสผ่านใหม่"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              required
            />
          </div>
          <Msg msg={pwMsg} />
          <button className="btn btn-primary" disabled={pwBusy}>
            {pwBusy ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
          </button>
          <p className="text-xs text-stone-500">อุปกรณ์อื่นที่ login อยู่จะถูกออกจากระบบ ยกเว้นเครื่องนี้</p>
        </form>
      </Card>

      <Card icon={ComputerDesktopIcon} title="อุปกรณ์อื่น">
        <p className="mb-3 text-sm text-stone-600">ถ้าเคย login ไว้ที่เครื่องอื่นแล้วลืมออก กดปุ่มนี้เพื่อออกจากระบบทุกเครื่อง ยกเว้นเครื่องนี้</p>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-ghost ring-1 ring-stone-300" onClick={logoutOthers}>
            ออกจากระบบทุกอุปกรณ์อื่น
          </button>
          <Msg msg={othersMsg} />
        </div>
      </Card>

      <Card icon={SwatchIcon} title="การแสดงผล">
        <ThemePicker />
      </Card>

      <Card icon={BellAlertIcon} title="แจ้งเตือน Telegram">
        <TelegramSettings onAuthError={() => setUser(null)} />
      </Card>

      <Card icon={CalendarDaysIcon} title="เชื่อมกับปฏิทิน (Google / iPhone)">
        <IcsSettings onAuthError={() => setUser(null)} />
      </Card>

      <Card icon={TagIcon} title="ป้ายของการ์ดงาน">
        <LabelManager onAuthError={() => setUser(null)} />
      </Card>

      <Card icon={ArrowDownTrayIcon} title="ส่งออกบันทึก">
        <p className="mb-3 text-sm text-stone-600">ดาวน์โหลดบันทึกทั้งหมดของคุณ เรียงจากเก่าไปใหม่ (JSON รวมบอร์ดงาน การ์ด ป้าย และวันสำคัญด้วย) <strong>ไม่รวมไฟล์รูป</strong> รูปที่แนบไว้ดาวน์โหลดทีละรูปได้จากหน้าดูรูป</p>
        <div className="mb-4"><PhotoUsage onAuthError={() => setUser(null)} /></div>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-ghost ring-1 ring-stone-300" href="/api/export?format=md" download>
            <ArrowDownTrayIcon className="size-4" aria-hidden="true" />
            Markdown (.md)
          </a>
          <a className="btn btn-ghost ring-1 ring-stone-300" href="/api/export?format=json" download>
            <ArrowDownTrayIcon className="size-4" aria-hidden="true" />
            JSON
          </a>
        </div>
      </Card>

      <Card icon={ExclamationTriangleIcon} title="ลบบัญชี" danger>
        <p className="mb-3 text-sm text-stone-600">
          ลบบัญชีและบันทึก<strong>ทั้งหมด</strong>ถาวร กู้คืนไม่ได้ แนะนำให้ส่งออกบันทึกเก็บไว้ก่อน
        </p>
        <form onSubmit={deleteAccount} className="space-y-3">
          <Field
            label={`พิมพ์ชื่อผู้ใช้ "${user.username}" เพื่อยืนยัน`}
            value={del.username}
            onChange={(e) => setDel({ ...del, username: e.target.value })}
            autoComplete="off"
          />
          <Field
            label="รหัสผ่าน"
            type="password"
            autoComplete="current-password"
            value={del.password}
            onChange={(e) => setDel({ ...del, password: e.target.value })}
          />
          <Msg msg={delMsg} />
          <button className="btn bg-red-600 text-white hover:bg-red-700" disabled={!canDelete || delBusy}>
            {delBusy ? "กำลังลบ…" : "ลบบัญชีถาวร"}
          </button>
        </form>
      </Card>
    </div>
  );
}

function thaiError(msg) {
  const map = {
    "current password is incorrect": "รหัสผ่านปัจจุบันไม่ถูกต้อง",
    "password is incorrect": "รหัสผ่านไม่ถูกต้อง",
    "password must be 8-72 characters": "รหัสผ่านต้องยาว 8–72 ตัวอักษร",
    "too many attempts, try again later": "ลองผิดหลายครั้งเกินไป รอ 15 นาทีแล้วลองใหม่",
  };
  return map[msg] || msg;
}
