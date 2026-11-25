from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="vehicle_scope",
            field=models.CharField(
                blank=True,
                choices=[
                    ("auto", "Automobile"),
                    ("moto", "Moto"),
                    ("both", "Automobile et moto"),
                ],
                max_length=8,
            ),
        ),
    ]
