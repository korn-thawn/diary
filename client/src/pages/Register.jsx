import { Link } from "react-router";
import { useAuth } from "../auth";
import AuthForm from "./AuthForm";

export default function Register() {
  const { register } = useAuth();
  return (
    <AuthForm
      title="สมัครสมาชิก"
      submitLabel="สมัคร"
      onSubmit={register}
      minPassword={8}
      footer={
        <>
          มีบัญชีแล้ว?{" "}
          <Link to="/login" className="text-accent hover:underline">
            เข้าสู่ระบบ
          </Link>
        </>
      }
    />
  );
}
