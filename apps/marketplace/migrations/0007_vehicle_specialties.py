from django.db import migrations


SPECIALTIES = {
    "voiture": (
        ("Mécanique générale", "mecanique-generale"),
        ("Électricité automobile", "electricite-auto"),
        ("Diagnostic électronique", "diagnostic-electronique"),
        ("Climatisation automobile", "climatisation-auto"),
        ("Carrosserie", "carrosserie"),
        ("Moteur et transmission", "moteur-transmission-auto"),
    ),
    "moto": (
        ("Mécanique générale", "mecanique-generale"),
        ("Réparation moteur moto", "moteur-moto"),
        ("Électricité moto", "electricite-moto"),
        ("Transmission moto", "transmission-moto"),
        ("Entretien et vidange moto", "entretien-vidange-moto"),
        ("Pneumatiques moto", "pneumatiques-moto"),
    ),
}


def create_vehicle_specialties(apps, schema_editor):
    Service = apps.get_model("marketplace", "Service")
    VehicleType = apps.get_model("marketplace", "VehicleType")
    database = schema_editor.connection.alias

    for vehicle_slug, specialties in SPECIALTIES.items():
        vehicle = VehicleType.objects.using(database).get(slug=vehicle_slug)
        for name, slug in specialties:
            service, _ = Service.objects.using(database).get_or_create(
                slug=slug,
                defaults={"name": name},
            )
            service.vehicle_types.add(vehicle)


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0006_repairshop_years_experience_repairshopphoto"),
    ]

    operations = [
        migrations.RunPython(
            create_vehicle_specialties,
            migrations.RunPython.noop,
        ),
    ]
