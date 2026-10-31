import { Link } from "react-router";
import { useAuth } from "../auth";
import AuthForm from "./AuthForm";

export default function Login() {
  const { login, allowRegister } = useAuth();
  return (
    <AuthForm
      title="เข้าสู่ระบบ"
      submitLabel="เข้าสู่ระบบ"
      onSubmit={login}
      footer={
        allowRegister && (
          <>
            ยังไม่มีบัญชี?{" "}
            <Link to="/register" className="text-accent hover:underline">
              สมัครสมาชิก
            </Link>
          </>
        )
      }
    />
  );
}
