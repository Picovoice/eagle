import os
import shutil

import setuptools


INCLUDE_FILES = ("../../LICENSE", "eagle_demo_file.py", "eagle_demo_mic.py")

os.system("git clean -dfx")

package_folder = os.path.join(os.path.dirname(__file__), "pveagledemo")
os.mkdir(package_folder)
manifest_in = ""

for rel_path in INCLUDE_FILES:
    shutil.copy(os.path.join(os.path.dirname(__file__), rel_path), package_folder)
    manifest_in += "include pveagledemo/%s\n" % os.path.basename(rel_path)

with open(os.path.join(os.path.dirname(__file__), "MANIFEST.in"), "w") as f:
    f.write(manifest_in)

with open(os.path.join(os.path.dirname(__file__), "README.md"), "r") as f:
    long_description = f.read()

setuptools.setup(
    name="pveagledemo",
    version="1.0.3",
    author="Picovoice",
    author_email="hello@picovoice.ai",
    description="Eagle Speaker Recognition Engine demos",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/Picovoice/eagle",
    packages=["pveagledemo"],
    install_requires=["pveagle==1.0.2", "pvrecorder==1.2.2"],
    include_package_data=True,
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: Apache Software License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Topic :: Multimedia :: Sound/Audio :: Speech",
    ],
    entry_points=dict(
        console_scripts=[
            "eagle_demo_file=pveagledemo.eagle_demo_file:main",
            "eagle_demo_mic=pveagledemo.eagle_demo_mic:main",
        ],
    ),
    python_requires=">=3.8",
    keywords="Speaker Recognition, Speaker Identification, Voice Recognition, Voice Identification",
)
