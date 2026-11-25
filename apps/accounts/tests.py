from io import BytesIO

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory
from rest_framework.test import APITestCase
from PIL import Image

from apps.marketplace.models import RepairShop
from .admin import ProfessionalVerificationAdmin, VerificationAdminForm
from .models import (
    ProfessionalVerification,
    VerificationDecision,
    VerificationDocument,
)

User = get_user_model()


class AccountApiTests(APITestCase):
    def tearDown(self):
        for document in VerificationDocument.objects.all():
            document.file.delete(save=False)
        for user in User.objects.exclude(profile_photo=""):
            user.profile_photo.delete(save=False)
        super().tearDown()

    def test_registration_hashes_password_and_returns_customer_role(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "new-client",
                "email": "client@example.com",
                "password": "ClientPass123!secure",
                "role": "customer",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="new-client")
        self.assertTrue(user.check_password("ClientPass123!secure"))
        self.assertEqual(response.data["role"], User.Role.CUSTOMER)

    def test_registration_accepts_a_simple_username_without_character_rules(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "Jean Paul!",
                "email": "jean.paul@example.com",
                "password": "ClientPass123!secure",
                "role": "customer",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(username="Jean Paul!").exists())

    def test_mechanic_can_update_public_profile_and_profile_photo(self):
        mechanic = User.objects.create_user(
            username="profile-mechanic",
            email="profile-mechanic@example.com",
            password="MechanicPass123!secure",
            role=User.Role.MECHANIC,
        )
        self.client.force_authenticate(mechanic)
        image_buffer = BytesIO()
        Image.new("RGB", (4, 4), color="blue").save(image_buffer, format="PNG")

        response = self.client.patch(
            "/api/auth/me/",
            {
                "first_name": "Awa",
                "last_name": "Mécano",
                "phone": "+22961000000",
                "profile_photo": SimpleUploadedFile(
                    "portrait.png", image_buffer.getvalue(), content_type="image/png"
                ),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["first_name"], "Awa")
        self.assertEqual(response.data["last_name"], "Mécano")
        self.assertTrue(response.data["profile_photo"].endswith(".png"))
        mechanic.refresh_from_db()
        self.assertTrue(mechanic.profile_photo.name.startswith("profiles/"))

    def test_mechanic_can_submit_private_documents_and_only_authorized_admin_can_download(self):
        mechanic = User.objects.create_user(
            username="verification-mechanic",
            email="verification-mechanic@example.com",
            password="MechanicPass123!secure",
            role=User.Role.MECHANIC,
        )
        identity = SimpleUploadedFile(
            "identity.pdf", b"%PDF-1.7\nID", content_type="application/pdf"
        )
        business = SimpleUploadedFile(
            "workshop.pdf", b"%PDF-1.7\nWorkshop", content_type="application/pdf"
        )
        self.client.force_authenticate(mechanic)

        response = self.client.post(
            "/api/auth/verification/",
            {
                "identity_document": identity,
                "business_document": business,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], ProfessionalVerification.Status.PENDING)
        self.assertEqual(len(response.data["documents"]), 2)
        self.assertNotIn("file", response.data["documents"][0])
        verification = ProfessionalVerification.objects.get(user=mechanic)
        document = verification.documents.first()
        self.assertTrue(str(document.file).startswith(f"verification/{verification.id}/"))
        self.assertFalse(
            document.file.storage.path(document.file.name).startswith(
                str(settings.MEDIA_ROOT.resolve())
            )
        )
        self.assertEqual(
            VerificationDecision.objects.filter(verification=verification).count(),
            1,
        )

        self.client.force_authenticate(user=None)
        self.client.force_login(mechanic)
        self.assertEqual(
            self.client.get(
                f"/api/auth/verification/documents/{document.id}/download/"
            ).status_code,
            403,
        )
        administrator = User.objects.create_superuser(
            username="verification-admin",
            email="verification-admin@example.com",
            password="AdminPass123!secure",
        )
        self.client.force_login(administrator)
        downloaded = self.client.get(
            f"/api/auth/verification/documents/{document.id}/download/"
        )
        self.assertEqual(downloaded.status_code, 200)
        self.assertEqual(b"".join(downloaded.streaming_content), b"%PDF-1.7\nID")
        self.assertEqual(downloaded["Cache-Control"], "private, no-store")
        self.assertEqual(downloaded["X-Content-Type-Options"], "nosniff")
        self.assertEqual(
            self.client.get(f"{settings.MEDIA_URL}{document.file.name}").status_code,
            404,
        )

    def test_invalid_verification_upload_and_user_supplied_status_are_rejected(self):
        mechanic = User.objects.create_user(
            username="verification-invalid",
            email="verification-invalid@example.com",
            password="MechanicPass123!secure",
            role=User.Role.MECHANIC,
        )
        self.client.force_authenticate(mechanic)

        invalid_file = self.client.post(
            "/api/auth/verification/",
            {
                "identity_document": SimpleUploadedFile(
                    "identity.pdf", b"not a PDF", content_type="application/pdf"
                ),
                "business_document": SimpleUploadedFile(
                    "business.pdf", b"%PDF-1.4\nproof", content_type="application/pdf"
                ),
                "status": "verified",
            },
            format="multipart",
        )
        self.assertEqual(invalid_file.status_code, 400)
        self.assertFalse(ProfessionalVerification.objects.filter(user=mechanic).exists())
        self.assertEqual(
            self.client.patch("/api/auth/me/", {"role": "admin"}).status_code, 200
        )
        self.assertEqual(
            self.client.get("/api/auth/verification/").data["status"],
            ProfessionalVerification.Status.NOT_SUBMITTED,
        )

    def test_admin_decision_is_audited_and_controls_the_professional_badge(self):
        mechanic = User.objects.create_user(
            username="verification-decision",
            email="verification-decision@example.com",
            password="MechanicPass123!secure",
            role=User.Role.MECHANIC,
        )
        shop = RepairShop.objects.create(
            owner=mechanic,
            name="Atelier vérification",
            business_type=RepairShop.BusinessType.GARAGE,
            district="Banikanni",
            phone="+22961000000",
        )
        verification = ProfessionalVerification.objects.create(
            user=mechanic, status=ProfessionalVerification.Status.PENDING
        )
        administrator = User.objects.create_superuser(
            username="decision-admin",
            email="decision-admin@example.com",
            password="AdminPass123!secure",
        )

        rejected_form = VerificationAdminForm(
            {
                "status": ProfessionalVerification.Status.REJECTED,
                "rejection_reason": "",
            },
            instance=verification,
        )
        self.assertFalse(rejected_form.is_valid())

        form = VerificationAdminForm(
            {
                "status": ProfessionalVerification.Status.VERIFIED,
                "rejection_reason": "",
            },
            instance=verification,
        )
        self.assertTrue(form.is_valid(), form.errors)
        updated = form.save(commit=False)
        request = RequestFactory().post("/")
        request.user = administrator
        model_admin = ProfessionalVerificationAdmin(
            ProfessionalVerification, admin.site
        )
        model_admin.message_user = lambda *args, **kwargs: None
        model_admin.save_model(request, updated, form, change=True)

        shop.refresh_from_db()
        verification.refresh_from_db()
        self.assertEqual(verification.status, ProfessionalVerification.Status.VERIFIED)
        self.assertTrue(shop.is_verified)
        self.assertEqual(
            verification.decisions.get().new_status,
            ProfessionalVerification.Status.VERIFIED,
        )

        rejected = VerificationAdminForm(
            {
                "status": ProfessionalVerification.Status.REJECTED,
                "rejection_reason": "Le justificatif d’activité est illisible.",
            },
            instance=verification,
        )
        self.assertTrue(rejected.is_valid(), rejected.errors)
        updated = rejected.save(commit=False)
        model_admin.save_model(request, updated, rejected, change=True)
        shop.refresh_from_db()
        verification.refresh_from_db()
        self.assertEqual(verification.status, ProfessionalVerification.Status.REJECTED)
        self.assertEqual(
            verification.rejection_reason,
            "Le justificatif d’activité est illisible.",
        )
        self.assertFalse(shop.is_verified)
        self.assertEqual(verification.decisions.count(), 2)

    def test_mechanic_registration_saves_vehicle_scope_in_shared_profile(self):
        registration = self.client.post(
            "/api/auth/register/",
            {
                "username": "auto-mechanic",
                "email": "auto-mechanic@example.com",
                "password": "AutoMechanicPass123!secure",
                "role": "mechanic",
                "vehicle_scope": "auto",
            },
            format="json",
        )

        self.assertEqual(registration.status_code, 201)
        self.assertEqual(registration.data["vehicle_scope"], "auto")

        token = self.client.post(
            "/api/auth/token/",
            {
                "username": "auto-mechanic",
                "password": "AutoMechanicPass123!secure",
            },
            format="json",
        )
        self.assertEqual(token.status_code, 200)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {token.data['access']}"
        )
        profile = self.client.get("/api/auth/me/")

        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.data["vehicle_scope"], "auto")

    def test_registration_cannot_create_admin_account(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "admin-attempt",
                "email": "admin-attempt@example.com",
                "password": "ClientPass123!secure",
                "role": "admin",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="admin-attempt").exists())
