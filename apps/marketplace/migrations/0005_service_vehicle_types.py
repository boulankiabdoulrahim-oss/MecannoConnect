from django.db import migrations, models


AUTO_SERVICES = (
    ("Carrosserie", "carrosserie"),
    ("Climatisation automobile", "climatisation-auto"),
    ("Boîte de vitesses", "boite-vitesses"),
)
MOTO_SERVICES = (
    ("Chaîne et transmission", "chaine-transmission"),
    ("Carburateur", "carburateur"),
    ("Suspension moto", "suspension-moto"),
)


def assign_service_vehicle_types(apps, schema_editor):
    Service = apps.get_model("marketplace", "Service")
    VehicleType = apps.get_model("marketplace", "VehicleType")
    database = schema_editor.connection.alias
    vehicles = {
        vehicle.slug: vehicle
        for vehicle in VehicleType.objects.using(database).all()
    }

    general_services = Service.objects.using(database).filter(
        vehicle_types__isnull=True
    )
    for service in general_services:
        service.vehicle_types.add(vehicles["voiture"], vehicles["moto"])

    for name, slug in AUTO_SERVICES:
        service, _ = Service.objects.using(database).get_or_create(
            slug=slug, defaults={"name": name}
        )
        service.vehicle_types.add(vehicles["voiture"])
    for name, slug in MOTO_SERVICES:
        service, _ = Service.objects.using(database).get_or_create(
            slug=slug, defaults={"name": name}
        )
        service.vehicle_types.add(vehicles["moto"])


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0004_repairshop_photo"),
    ]

    operations = [
        migrations.AddField(
            model_name="service",
            name="vehicle_types",
            field=models.ManyToManyField(
                blank=True, related_name="services", to="marketplace.vehicletype"
            ),
        ),
        migrations.RunPython(assign_service_vehicle_types, migrations.RunPython.noop),
    ]
